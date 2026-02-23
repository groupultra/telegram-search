// Command server starts the Telegram Search webhook server.
//
// It exposes:
//   - POST /webhook — Telegram Bot API webhook endpoint
//   - GET  /health  — liveness probe
//
// All components are wired via uber/fx for clean dependency injection and
// lifecycle management.  The process handles SIGINT / SIGTERM gracefully.
//
// Usage:
//
//	TGS_BOT_TOKEN=... TGS_BOT_WEBHOOK_URL=https://example.com ./server
package main

import (
	"go.uber.org/fx"
	"go.uber.org/fx/fxevent"
	"go.uber.org/zap"

	"github.com/groupultra/telegram-search/internal/bot"
	"github.com/groupultra/telegram-search/internal/config"
	"github.com/groupultra/telegram-search/internal/db"
	"github.com/groupultra/telegram-search/internal/embed"
	"github.com/groupultra/telegram-search/internal/search"
	"github.com/groupultra/telegram-search/internal/server"
	syncsvc "github.com/groupultra/telegram-search/internal/sync"
	"github.com/groupultra/telegram-search/internal/tgclient"
)

func main() {
	app := fx.New(
		fx.Provide(newLogger),
		fx.WithLogger(func(log *zap.Logger) fxevent.Logger {
			return &fxevent.ZapLogger{Logger: log.Named("fx")}
		}),

		config.Module,
		db.Module,
		embed.Module,
		search.Module,
		tgclient.Module,
		syncsvc.Module,
		server.Module,
		bot.Module,

		// Provide *tgclient.Client as tgclient.API so the sync service can be wired.
		fx.Provide(func(c *tgclient.Client) tgclient.API { return c }),
	)

	app.Run()
}

// newLogger builds the production zap logger used across the entire process.
// NOTE: JSON output makes logs easy to ingest in Loki, Datadog, CloudWatch, etc.
func newLogger() (*zap.Logger, error) {
	return zap.NewProduction()
}
