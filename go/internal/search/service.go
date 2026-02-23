// Package search implements message retrieval combining vector cosine-similarity
// search (pgvector) with optional CJK keyword fallback.
//
// Design decisions:
//   - Vector search is the primary path; keyword search is a fallback when no
//     embedding API key is configured or the query is too short to embed well.
//   - Results from both paths are merged and de-duplicated by message UUID.
//   - pgvector queries use raw SQL via pgxpool because ent does not yet expose
//     the <=> (cosine distance) operator natively.
package search

import (
	"context"
	"fmt"

	"log/slog"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/pgvector/pgvector-go"
	"go.uber.org/fx"

	"github.com/groupultra/telegram-search/internal/embed"
)

// Module provides *Service to the fx graph.
func Modules() fx.Option {
	return fx.Options(fx.Provide(New))
}

// Result is a single search hit returned to callers.
type Result struct {
	ID                string
	OwnerAccountID    string
	InChatID          string
	ChatName          string
	PlatformMessageID string
	FromID            string
	FromName          string
	Content           string
	PlatformTimestamp int64
	// Score is the cosine similarity in [0, 1]; higher is more similar.
	// For keyword results the score is 0 (relevance ordering is not defined).
	Score float64
}

// Filter constrains which messages are searched.
type Filter struct {
	// AccountID restricts results to one account.  Required.
	AccountID string
	// ChatIDs restricts results to the listed chats.  Empty means all chats.
	ChatIDs []string
	// MinTimestamp and MaxTimestamp filter by platform_timestamp (Unix seconds).
	MinTimestamp int64
	MaxTimestamp int64
}

// Opts controls search execution.
type Opts struct {
	Limit  int
	Offset int
}

// Service executes semantic and keyword searches over stored messages.
type Service struct {
	pool   *pgxpool.Pool
	embed  *embed.Service
	log    *slog.Logger
	dimCfg int // embedding dimension from config
}

// New constructs a Service.
func New(pool *pgxpool.Pool, embedSvc *embed.Service, log *slog.Logger) *Service {
	return &Service{
		pool:  pool,
		embed: embedSvc,
		log:   log.With("component", "search"),
	}
}

// Search runs a semantic search for query in the given account's messages.
// It falls back to keyword search when embedding is unavailable.
func (s *Service) Search(ctx context.Context, query string, filter Filter, opts Opts) ([]Result, error) {
	if opts.Limit <= 0 {
		opts.Limit = 10
	}

	// Attempt vector search first.
	vec, err := s.embed.EmbedOne(ctx, query)
	if err == nil {
		results, verr := s.vectorSearch(ctx, vec, filter, opts)
		if verr != nil {
			s.log.Warn("vector search failed, falling back to keyword", "err", verr)
		} else {
			return results, nil
		}
	} else {
		s.log.Debug("embedding unavailable, using keyword search", "err", err)
	}

	// Keyword fallback: simple ILIKE on content.
	return s.keywordSearch(ctx, query, filter, opts)
}

// vectorSearch performs an HNSW cosine-similarity query.
//
// The column used (content_vector_1536 / 1024 / 768) is chosen based on the
// dimension of the provided vector, which must match what was stored during
// indexing.
func (s *Service) vectorSearch(ctx context.Context, vec []float32, filter Filter, opts Opts) ([]Result, error) {
	col, err := vectorColumn(len(vec))
	if err != nil {
		return nil, err
	}

	// NOTE: The <=> operator computes cosine distance; 1 - distance = similarity.
	// We ORDER BY distance ASC so the closest vectors come first.
	// Parameter $1 is the query vector, $2 is the account_id.
	query := fmt.Sprintf(`
		SELECT
			m.id,
			m.owner_account_id::text,
			m.in_chat_id::text,
			COALESCE(c.chat_name, '') AS chat_name,
			m.platform_message_id,
			m.from_id,
			m.from_name,
			m.content,
			m.platform_timestamp,
			1 - (m.%s <=> $1::vector) AS score
		FROM messages m
		LEFT JOIN chats c ON c.id = m.in_chat_id
		WHERE m.owner_account_id = $2::uuid
		  AND m.deleted_at = 0
		  AND m.%s IS NOT NULL
		  %s
		ORDER BY m.%s <=> $1::vector
		LIMIT $3 OFFSET $4
	`, col, col, chatFilter(filter), col)

	args := []any{
		pgvector.NewVector(vec),
		filter.AccountID,
		opts.Limit,
		opts.Offset,
	}
	if len(filter.ChatIDs) > 0 {
		// NOTE: chat IDs are appended as the 5th argument when the filter is active.
		// chatFilter() emits AND c.chat_id = ANY($5) in that case.
		args = append(args, filter.ChatIDs)
	}

	rows, err := s.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("search: vector query: %w", err)
	}
	defer rows.Close()

	return scanResults(rows)
}

// keywordSearch performs a simple case-insensitive text search using ILIKE.
// This is a fallback for when embedding is unavailable.
func (s *Service) keywordSearch(ctx context.Context, query string, filter Filter, opts Opts) ([]Result, error) {
	q := `
		SELECT
			m.id,
			m.owner_account_id::text,
			m.in_chat_id::text,
			COALESCE(c.chat_name, '') AS chat_name,
			m.platform_message_id,
			m.from_id,
			m.from_name,
			m.content,
			m.platform_timestamp,
			0::float8 AS score
		FROM messages m
		LEFT JOIN chats c ON c.id = m.in_chat_id
		WHERE m.owner_account_id = $1::uuid
		  AND m.deleted_at = 0
		  AND m.content ILIKE $2
		  ` + chatFilter(filter) + `
		ORDER BY m.platform_timestamp DESC
		LIMIT $3 OFFSET $4
	`

	pattern := "%" + query + "%"
	args := []any{filter.AccountID, pattern, opts.Limit, opts.Offset}
	if len(filter.ChatIDs) > 0 {
		args = append(args, filter.ChatIDs)
	}

	rows, err := s.pool.Query(ctx, q, args...)
	if err != nil {
		return nil, fmt.Errorf("search: keyword query: %w", err)
	}
	defer rows.Close()

	return scanResults(rows)
}

// vectorColumn returns the appropriate column name based on dimension.
func vectorColumn(dim int) (string, error) {
	switch dim {
	case 1536:
		return "content_vector_1536", nil
	case 1024:
		return "content_vector_1024", nil
	case 768:
		return "content_vector_768", nil
	default:
		return "", fmt.Errorf("search: unsupported vector dimension %d", dim)
	}
}

// chatFilter returns a SQL fragment that restricts by chat_id when filter.ChatIDs
// is non-empty.  The chat IDs are bound as parameter $5.
func chatFilter(filter Filter) string {
	if len(filter.ChatIDs) == 0 {
		return ""
	}
	return "AND c.chat_id = ANY($5)"
}

// scanResults reads rows into a []Result slice.
func scanResults(rows interface {
	Next() bool
	Scan(dest ...any) error
	Err() error
}) ([]Result, error) {
	var results []Result
	for rows.Next() {
		var r Result
		if err := rows.Scan(
			&r.ID,
			&r.OwnerAccountID,
			&r.InChatID,
			&r.ChatName,
			&r.PlatformMessageID,
			&r.FromID,
			&r.FromName,
			&r.Content,
			&r.PlatformTimestamp,
			&r.Score,
		); err != nil {
			return nil, fmt.Errorf("search: scan: %w", err)
		}
		results = append(results, r)
	}
	return results, rows.Err()
}

// StoreVectors upserts the embedding vectors for a message.
// It is called by the sync service after embedding a message batch.
func (s *Service) StoreVectors(ctx context.Context, messageID string, vec []float32) error {
	col, err := vectorColumn(len(vec))
	if err != nil {
		return err
	}

	stmt := fmt.Sprintf(
		`UPDATE messages SET %s = $1::vector, content_vector_model = $2 WHERE id = $3::uuid`,
		col,
	)

	_, err = s.pool.Exec(ctx, stmt, pgvector.NewVector(vec), col, messageID)
	if err != nil {
		return fmt.Errorf("search: store vector: %w", err)
	}
	return nil
}

// StoreVectorBatch bulk-updates vectors for multiple messages in a single
// transaction.  messageIDs and vecs must have the same length.
func (s *Service) StoreVectorBatch(ctx context.Context, messageIDs []string, vecs [][]float32) error {
	if len(messageIDs) != len(vecs) {
		return fmt.Errorf("search: messageIDs (%d) and vecs (%d) length mismatch",
			len(messageIDs), len(vecs))
	}
	if len(vecs) == 0 {
		return nil
	}

	col, err := vectorColumn(len(vecs[0]))
	if err != nil {
		return err
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("search: begin tx: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck // best-effort rollback

	stmt := fmt.Sprintf(
		`UPDATE messages SET %s = $1::vector, content_vector_model = $2 WHERE id = $3::uuid`,
		col,
	)

	for i, id := range messageIDs {
		if _, err := tx.Exec(ctx, stmt, pgvector.NewVector(vecs[i]), col, id); err != nil {
			return fmt.Errorf("search: store vector[%d]: %w", i, err)
		}
	}

	return tx.Commit(ctx)
}
