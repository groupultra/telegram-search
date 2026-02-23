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
	"log/slog"
	"os"

	"go.uber.org/fx"
	"go.uber.org/fx/fxevent"

	"github.com/groupultra/telegram-search/internal/config"
	"github.com/groupultra/telegram-search/internal/db"
	"github.com/groupultra/telegram-search/internal/provider/embed"
	"github.com/groupultra/telegram-search/internal/provider/search"
	"github.com/groupultra/telegram-search/internal/provider/takeout"
	"github.com/groupultra/telegram-search/internal/tui"
	"github.com/groupultra/telegram-search/pkg/tgclient"
	"github.com/lmittmann/tint"
	"github.com/spf13/cobra"
)

func main() {
	root := &cobra.Command{
		Use: "tui",
		RunE: func(cmd *cobra.Command, args []string) error {
			slog.SetDefault(slog.New(tint.NewHandler(os.Stdout, nil)))

			app := fx.New(
				fx.Provide(newDevLogger),
				fx.WithLogger(func(log *slog.Logger) fxevent.Logger {
					return &fxevent.SlogLogger{Logger: log}
				}),

				config.Modules(),
				db.Modules(),
				embed.Modules(),
				search.Modules(),
				tgclient.Modules(),
				takeout.Modules(),

				// Provide *tgclient.Client as tgclient.API so fx can wire it.
				fx.Provide(func(c *tgclient.Client) tgclient.API { return c }),

				// Start the TUI instead of an HTTP server.
				fx.Invoke(runTUI),
			)

			app.Run()

			return nil
		},
	}

	if err := root.Execute(); err != nil {
		slog.Error("Failed to execute command", "error", err)
	}
}

// runTUI builds the TUI model and starts the Bubble Tea program.
func runTUI(
	lc fx.Lifecycle,
	searchSvc *search.Service,
	takeoutSvc *takeout.Service,
	tgc tgclient.API,
	log *slog.Logger,
) {
	lc.Append(fx.Hook{
		OnStart: func(_ context.Context) error {
			go func() {
				deps := tui.Deps{
					Search:    searchSvc,
					Takeout:   takeoutSvc,
					TGClient:  tgc,
					AccountID: "",
				}

				if err := tui.Run(deps); err != nil {
					log.Error("TUI exited with error", "err", err)
					fmt.Fprintln(os.Stderr, "error:", err)
				}

				os.Exit(0)
			}()

			return nil
		},
	})
}

// newDevLogger builds a human-readable console logger at WARN level.
// Logs go to stderr so they don't corrupt the Bubble Tea alternate screen.
func newDevLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{
		Level: slog.LevelWarn,
	}))
}
