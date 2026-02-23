// Package db wires the database connections and exposes two primitives:
//   - *ent.Client for ORM-managed tables (accounts, chats, messages, users).
//   - *pgxpool.Pool for raw SQL needed by pgvector operations.
//
// Both share the same Postgres DSN and are lifecycle-managed by fx.
//
// NOTE: The ent.Client requires generated code from `make generate`.
// The pgxpool.Pool is always available and used by packages that need
// raw SQL (sync, search vector ops).
package db

import (
	"context"
	"database/sql"
	"fmt"

	"entgo.io/ent/dialect"
	entsql "entgo.io/ent/dialect/sql"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jackc/pgx/v5/stdlib"
	"go.uber.org/fx"
	"go.uber.org/zap"

	"github.com/groupultra/telegram-search/ent"
	"github.com/groupultra/telegram-search/internal/config"
)

// Module provides *ent.Client and *pgxpool.Pool to the fx graph.
var Module = fx.Module("db",
	fx.Provide(NewPool),
	fx.Provide(NewEntClient),
	fx.Invoke(migrate),
)

// NewPool creates a pgxpool.Pool configured from cfg.
// The pool is closed when the fx lifecycle ends.
func NewPool(lc fx.Lifecycle, cfg *config.Config, log *zap.Logger) (*pgxpool.Pool, error) {
	dsn := cfg.Database.DSNOrBuild()

	poolCfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		return nil, fmt.Errorf("db: parse dsn: %w", err)
	}

	poolCfg.MaxConns = cfg.Database.MaxConns
	poolCfg.MinConns = cfg.Database.MinConns

	pool, err := pgxpool.NewWithConfig(context.Background(), poolCfg)
	if err != nil {
		return nil, fmt.Errorf("db: open pool: %w", err)
	}

	lc.Append(fx.Hook{
		OnStart: func(ctx context.Context) error {
			if err := pool.Ping(ctx); err != nil {
				return fmt.Errorf("db: ping: %w", err)
			}
			log.Info("database connection established", zap.String("dsn", redactDSN(dsn)))
			return nil
		},
		OnStop: func(_ context.Context) error {
			pool.Close()
			log.Info("database connection closed")
			return nil
		},
	})

	return pool, nil
}

// NewEntClient wraps the pgxpool with an ent.Client.
// We use stdlib.OpenDBFromPool so ent and pgxpool share the same connections.
func NewEntClient(pool *pgxpool.Pool) (*ent.Client, error) {
	sqlDB := stdlib.OpenDBFromPool(pool)
	drv := entsql.OpenDB(dialect.Postgres, sqlDB)
	client := ent.NewClient(ent.Driver(drv))
	return client, nil
}

// migrate runs ent auto-migration and ensures pgvector columns exist.
// NOTE: In production replace this with an Atlas migration workflow
// (`atlas migrate apply`) to get versioned, reviewable migrations.
func migrate(lc fx.Lifecycle, client *ent.Client, pool *pgxpool.Pool, log *zap.Logger) {
	lc.Append(fx.Hook{
		OnStart: func(ctx context.Context) error {
			log.Info("running ent schema migration")
			if err := client.Schema.Create(ctx); err != nil {
				return fmt.Errorf("db: schema migrate: %w", err)
			}
			// Ensure pgvector extension and vector columns exist.
			// These are outside ent's schema, so we manage them via raw SQL.
			if err := ensureVectorColumns(ctx, stdlib.OpenDBFromPool(pool)); err != nil {
				return fmt.Errorf("db: vector columns: %w", err)
			}
			log.Info("schema migration complete")
			return nil
		},
	})
}

// ensureVectorColumns idempotently creates the pgvector extension and the
// vector columns on the messages table.  IF NOT EXISTS makes this idempotent.
func ensureVectorColumns(ctx context.Context, db *sql.DB) error {
	stmts := []string{
		`CREATE EXTENSION IF NOT EXISTS vector`,
		`ALTER TABLE messages ADD COLUMN IF NOT EXISTS content_vector_1536 vector(1536)`,
		`ALTER TABLE messages ADD COLUMN IF NOT EXISTS content_vector_1024 vector(1024)`,
		`ALTER TABLE messages ADD COLUMN IF NOT EXISTS content_vector_768  vector(768)`,
		// HNSW indexes give better query latency than IVFFlat for moderate dataset sizes.
		`CREATE INDEX IF NOT EXISTS messages_vector_1536_idx
			ON messages USING hnsw (content_vector_1536 vector_cosine_ops)`,
		`CREATE INDEX IF NOT EXISTS messages_vector_1024_idx
			ON messages USING hnsw (content_vector_1024 vector_cosine_ops)`,
		`CREATE INDEX IF NOT EXISTS messages_vector_768_idx
			ON messages USING hnsw (content_vector_768  vector_cosine_ops)`,
	}

	for _, stmt := range stmts {
		if _, err := db.ExecContext(ctx, stmt); err != nil {
			preview := stmt
			if len(preview) > 60 {
				preview = preview[:60]
			}
			return fmt.Errorf("exec %q: %w", preview, err)
		}
	}
	return nil
}

// redactDSN returns a placeholder to avoid logging credentials.
func redactDSN(_ string) string { return "<redacted>" }
