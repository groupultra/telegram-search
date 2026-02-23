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
	"log/slog"
	"os"

	"go.uber.org/fx"
	"go.uber.org/fx/fxevent"

	"github.com/groupultra/telegram-search/internal/bot"
	"github.com/groupultra/telegram-search/internal/config"
	"github.com/groupultra/telegram-search/internal/db"
	"github.com/groupultra/telegram-search/internal/provider/embed"
	"github.com/groupultra/telegram-search/internal/provider/search"
	"github.com/groupultra/telegram-search/internal/provider/takeout"
	"github.com/groupultra/telegram-search/internal/server"
	"github.com/groupultra/telegram-search/pkg/tgclient"
	"github.com/lmittmann/tint"
	"github.com/spf13/cobra"
)

func main() {

	root := &cobra.Command{
		Use: "backend-ng",
		RunE: func(cmd *cobra.Command, args []string) error {
			slog.SetDefault(slog.New(tint.NewHandler(os.Stdout, nil)))

			app := fx.New(
				fx.Provide(newLogger),
				fx.WithLogger(func(log *slog.Logger) fxevent.Logger {
					return &fxevent.SlogLogger{Logger: log}
				}),

				config.Modules(),
				db.Modules(),
				embed.Modules(),
				search.Modules(),
				tgclient.Modules(),
				takeout.Modules(),
				server.Modules(),
				bot.Modules(),

				// Provide *tgclient.Client as tgclient.API so the takeout service can be wired.
				fx.Provide(func(c *tgclient.Client) tgclient.API { return c }),
			)

			app.Run()
			return nil
		},
	}

	if err := root.Execute(); err != nil {
		slog.Error("Failed to execute command", "error", err)
	}

}

// newLogger builds the production JSON logger used across the entire process.
// JSON output makes logs easy to ingest in Loki, Datadog, CloudWatch, etc.
func newLogger() *slog.Logger {
	return slog.New(slog.NewJSONHandler(os.Stdout, nil))
}
