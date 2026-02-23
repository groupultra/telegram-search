// Command tui starts the interactive terminal user interface.
//
// The TUI lets operators:
//   - Authenticate a Telegram account (phone + code + optional 2FA).
//   - Trigger message sync (takeout) for selected or all chats.
//   - Run semantic search queries against the stored message archive.
//
// Unlike the server command, the TUI does NOT start an HTTP server or bot.
// It is intended for initial setup and manual operations.
//
// Usage:
//
//	TGS_DATABASE_DSN=postgres://... ./tui
package main

import (
	"context"
	"fmt"
	"os"

	"go.uber.org/fx"
	"go.uber.org/fx/fxevent"
	"go.uber.org/zap"

	"github.com/groupultra/telegram-search/internal/config"
	"github.com/groupultra/telegram-search/internal/db"
	"github.com/groupultra/telegram-search/internal/embed"
	"github.com/groupultra/telegram-search/internal/search"
	syncsvc "github.com/groupultra/telegram-search/internal/sync"
	"github.com/groupultra/telegram-search/internal/tgclient"
	"github.com/groupultra/telegram-search/internal/tui"
)

func main() {
	app := fx.New(
		fx.Provide(newDevLogger),
		fx.WithLogger(func(log *zap.Logger) fxevent.Logger {
			return &fxevent.ZapLogger{Logger: log.Named("fx")}
		}),

		config.Module,
		db.Module,
		embed.Module,
		search.Module,
		tgclient.Module,
		syncsvc.Module,

		// Provide *tgclient.Client as tgclient.API so fx can wire it.
		fx.Provide(func(c *tgclient.Client) tgclient.API { return c }),

		// Start the TUI instead of an HTTP server.
		fx.Invoke(runTUI),
	)

	app.Run()
}

// runTUI builds the TUI model and starts the Bubble Tea program.
func runTUI(
	lc fx.Lifecycle,
	searchSvc *search.Service,
	syncSvc *syncsvc.Service,
	tgc tgclient.API,
	log *zap.Logger,
) {
	lc.Append(fx.Hook{
		OnStart: func(_ context.Context) error {
			go func() {
				deps := tui.Deps{
					Search:    searchSvc,
					Sync:      syncSvc,
					TGClient:  tgc,
					AccountID: "",
				}

				if err := tui.Run(deps); err != nil {
					log.Error("TUI exited with error", zap.Error(err))
					fmt.Fprintln(os.Stderr, "error:", err)
				}
				os.Exit(0)
			}()
			return nil
		},
	})
}

// newDevLogger builds a human-readable console logger.
// Logs go to stderr so they don't corrupt the Bubble Tea alternate screen.
func newDevLogger() (*zap.Logger, error) {
	cfg := zap.NewDevelopmentConfig()
	cfg.Level.SetLevel(zap.WarnLevel)
	return cfg.Build()
}
