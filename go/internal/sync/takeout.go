// Package sync implements Telegram message history export.
//
// Architecture:
//   - Uses the tgclient.API interface for MTProto calls, keeping gotd/td
//     types confined to the tgclient package (no abstraction leaks).
//   - Each batch is embedded (via embed.Service) and stored via raw pgx.
//   - Progress is reported via a channel so callers (TUI, bot) can display it.
//
// NOTE: This package uses raw pgxpool queries instead of ent for DB writes
// because bulk-insert operations benefit from direct INSERT ... ON CONFLICT
// DO NOTHING semantics that ent does not expose efficiently.
package sync

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"time"

	"log/slog"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"go.uber.org/fx"

	"github.com/groupultra/telegram-search/internal/embed"
	"github.com/groupultra/telegram-search/internal/search"
	"github.com/groupultra/telegram-search/pkg/tgclient"
)

// Module provides *Service to the fx graph.
func Modules() fx.Option {
	return fx.Options(fx.Provide(New))
}

// Progress carries incremental progress information for a running sync job.
type Progress struct {
	ChatID   string
	ChatName string
	Done     int
	Total    int
	Msg      string
	Err      error
}

// SyncOpts configures a sync run.
type SyncOpts struct {
	// ChatIDs to sync; empty means all dialogs.
	ChatIDs []string
	// Incremental skips messages already in the DB.
	Incremental bool
	// BatchSize controls how many messages are fetched per GetHistory call.
	BatchSize int
	// EmbedBatch controls how many messages are embedded per API call.
	EmbedBatch int
}

const (
	defaultBatchSize  = 100
	defaultEmbedBatch = 50
	// historyInterval is the minimum pause between GetHistory calls to stay
	// within Telegram's rate limits.
	historyInterval = 500 * time.Millisecond
)

// Service orchestrates the takeout flow.
type Service struct {
	tg     tgclient.API
	pool   *pgxpool.Pool
	embed  *embed.Service
	search *search.Service
	log    *slog.Logger
}

// New constructs a Service.
func New(
	tgc tgclient.API,
	pool *pgxpool.Pool,
	embedSvc *embed.Service,
	searchSvc *search.Service,
	log *slog.Logger,
) *Service {
	return &Service{
		tg:     tgc,
		pool:   pool,
		embed:  embedSvc,
		search: searchSvc,
		log:    log.With("component", "sync"),
	}
}

// Run executes a full sync for the given account, reporting progress on ch.
// ch is closed when the sync finishes (with or without error).
func (s *Service) Run(ctx context.Context, accountID string, opts SyncOpts, ch chan<- Progress) {
	defer close(ch)

	if !s.tg.IsAuthenticated() {
		ch <- Progress{Err: errors.New("sync: MTProto client not authenticated")}
		return
	}

	batchSize := opts.BatchSize
	if batchSize <= 0 {
		batchSize = defaultBatchSize
	}

	chatIDs, chatNames, err := s.resolveChatIDs(ctx, opts.ChatIDs)
	if err != nil {
		ch <- Progress{Err: fmt.Errorf("sync: resolve chats: %w", err)}
		return
	}

	for i, chatID := range chatIDs {
		if ctx.Err() != nil {
			return
		}

		chatName := ""
		if i < len(chatNames) {
			chatName = chatNames[i]
		}

		if err := s.syncChat(ctx, accountID, chatID, chatName, opts, batchSize, ch); err != nil {
			s.log.Error("chat sync failed", "chat_id", chatID, "err", err)

			ch <- Progress{ChatID: chatID, Err: err}
		}
	}
}

// syncChat downloads and stores all messages for one chat.
func (s *Service) syncChat(
	ctx context.Context,
	accountID, chatID, chatName string,
	opts SyncOpts,
	batchSize int,
	ch chan<- Progress,
) error {
	s.log.Info("syncing chat", "chat_id", chatID)

	ch <- Progress{ChatID: chatID, ChatName: chatName, Msg: "starting sync"}

	offsetID := 0

	if opts.Incremental {
		if latest, _ := s.latestStoredMessageID(ctx, accountID, chatID); latest > 0 {
			offsetID = latest
		}
	}

	done := 0

	embedBatch := opts.EmbedBatch
	if embedBatch <= 0 {
		embedBatch = defaultEmbedBatch
	}

	type pending struct {
		msgUUID string
		content string
	}
	var buf []pending

	flushEmbeds := func() error {
		if len(buf) == 0 {
			return nil
		}

		texts := make([]string, len(buf))
		for i, p := range buf {
			texts[i] = p.content
		}

		result, embedErr := s.embed.Embed(ctx, texts)
		if embedErr != nil {
			// NOTE: Embedding failure is non-fatal; messages are stored without
			// vectors and can be re-embedded by a separate pass later.
			s.log.Warn("embedding batch failed; messages stored without vectors",
				"count", len(buf), "err", embedErr)

			buf = buf[:0]

			return nil
		}

		ids := make([]string, len(buf))
		for i, p := range buf {
			ids[i] = p.msgUUID
		}

		if storeErr := s.search.StoreVectorBatch(ctx, ids, result.Vectors); storeErr != nil {
			s.log.Warn("vector store failed", "err", storeErr)
		}

		buf = buf[:0]

		return nil
	}

	for {
		if ctx.Err() != nil {
			return ctx.Err()
		}

		select {
		case <-time.After(historyInterval):
		case <-ctx.Done():
			return ctx.Err()
		}

		messages, fetchErr := s.tg.GetHistory(ctx, chatID, offsetID, batchSize)
		if fetchErr != nil {
			return fmt.Errorf("fetch history: %w", fetchErr)
		}

		if len(messages) == 0 {
			break
		}

		for _, msg := range messages {
			msgUUID, upsertErr := s.upsertMessage(ctx, accountID, chatID, chatName, msg)
			if upsertErr != nil {
				s.log.Warn("upsert message failed",
					"msg_id", msg.ID, "err", upsertErr)

				continue
			}

			if msgUUID != "" {
				buf = append(buf, pending{msgUUID: msgUUID, content: msg.Text})
			}

			done++
		}

		if len(buf) >= embedBatch {
			if flushErr := flushEmbeds(); flushErr != nil {
				return flushErr
			}
		}

		ch <- Progress{
			ChatID:   chatID,
			ChatName: chatName,
			Done:     done,
			Msg:      fmt.Sprintf("synced %d messages", done),
		}

		offsetID = messages[len(messages)-1].ID
		if len(messages) < batchSize {
			break
		}
	}

	if err := flushEmbeds(); err != nil {
		return err
	}

	ch <- Progress{ChatID: chatID, ChatName: chatName, Done: done, Total: done, Msg: "done"}

	s.log.Info("chat sync complete", "chat_id", chatID, "messages", done)

	return nil
}

// upsertMessage inserts a message row, returning its UUID.
// Returns ("", nil) when the message already exists (ON CONFLICT DO NOTHING).
func (s *Service) upsertMessage(ctx context.Context, accountID, chatID, chatName string, msg tgclient.TGMessage) (string, error) {
	// Upsert chat — create if missing, update name if present.
	var chatUUID string

	err := s.pool.QueryRow(ctx, `
		INSERT INTO chats (platform, chat_id, chat_name, owner_account_id)
		VALUES ('telegram', $1, $2,
			(SELECT id FROM accounts WHERE phone = $3 LIMIT 1))
		ON CONFLICT (owner_account_id, chat_id)
		DO UPDATE SET chat_name = EXCLUDED.chat_name
		RETURNING id::text
	`, chatID, chatName, accountID).Scan(&chatUUID)
	if err != nil {
		return "", fmt.Errorf("upsert chat: %w", err)
	}

	// Insert message; silently skip duplicates.
	var msgUUID string

	scanErr := s.pool.QueryRow(ctx, `
		INSERT INTO messages (
			platform, platform_message_id, from_id,
			content, platform_timestamp, in_chat_id, owner_account_id
		)
		SELECT 'telegram', $1, $2, $3, $4, $5::uuid,
			(SELECT id FROM accounts WHERE phone = $6 LIMIT 1)
		ON CONFLICT (owner_account_id, in_chat_id, platform_message_id)
		DO NOTHING
		RETURNING id::text
	`,
		strconv.Itoa(msg.ID),
		msg.FromID,
		msg.Text,
		int64(msg.Date),
		chatUUID,
		accountID,
	).Scan(&msgUUID)
	if scanErr != nil {
		if errors.Is(scanErr, pgx.ErrNoRows) {
			return "", nil // already exists
		}

		return "", fmt.Errorf("upsert message: %w", scanErr)
	}

	return msgUUID, nil
}

// resolveChatIDs returns the list of chat IDs and names to sync.
func (s *Service) resolveChatIDs(ctx context.Context, chatIDs []string) ([]string, []string, error) {
	if len(chatIDs) > 0 {
		names := make([]string, len(chatIDs))
		return chatIDs, names, nil
	}

	dialogs, err := s.tg.GetDialogs(ctx)
	if err != nil {
		return nil, nil, fmt.Errorf("get dialogs: %w", err)
	}

	ids := make([]string, len(dialogs))

	names := make([]string, len(dialogs))
	for i, d := range dialogs {
		ids[i] = d.ID
		names[i] = d.Name
	}

	return ids, names, nil
}

// latestStoredMessageID returns the highest platform_message_id stored for
// the given account+chat, used for incremental sync offset.
func (s *Service) latestStoredMessageID(ctx context.Context, accountID, chatID string) (int, error) {
	var id int
	err := s.pool.QueryRow(ctx, `
		SELECT COALESCE(MAX(platform_message_id::int), 0)
		FROM messages m
		JOIN chats c ON c.id = m.in_chat_id
		JOIN accounts a ON a.id = m.owner_account_id
		WHERE a.phone = $1
		  AND c.chat_id = $2
	`, accountID, chatID).Scan(&id)

	return id, err
}
