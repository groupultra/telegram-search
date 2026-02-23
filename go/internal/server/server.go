// Package server provides the Echo HTTP server that:
//   - Receives Telegram Bot API webhook POST requests at /webhook.
//   - Exposes a GET /health endpoint for load-balancer probes.
//
// In distributed deployments multiple server instances can run behind a
// load-balancer; each request is stateless since all state lives in Postgres.
package server

import (
	"context"
	"fmt"
	"net/http"

	"log/slog"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	"go.uber.org/fx"

	"github.com/groupultra/telegram-search/internal/config"
)

// Module provides the Echo instance and registers lifecycle hooks.
func Modules() fx.Option {
	return fx.Options(
		fx.Provide(New),
		fx.Invoke(registerLifecycle),
	)
}

// New creates and configures the Echo instance.
// Route registration happens here; actual listening starts in registerLifecycle.
func New(cfg *config.Config, log *slog.Logger) *echo.Echo {
	e := echo.New()
	e.HideBanner = true
	e.HidePort = true

	// Structured request logging.
	e.Use(middleware.RequestLoggerWithConfig(middleware.RequestLoggerConfig{
		LogMethod: true,
		LogURI:    true,
		LogStatus: true,
		LogError:  true,
		LogValuesFunc: func(_ echo.Context, v middleware.RequestLoggerValues) error {
			if v.Error != nil {
				log.Error("http",
					"method", v.Method,
					"uri", v.URI,
					"status", v.Status,
					"err", v.Error,
				)
			} else {
				log.Info("http",
					"method", v.Method,
					"uri", v.URI,
					"status", v.Status,
				)
			}
			return nil
		},
	}))

	e.Use(middleware.Recover())

	// Health endpoint for liveness / readiness probes.
	e.GET("/health", func(c echo.Context) error {
		return c.JSON(http.StatusOK, map[string]string{"status": "ok"})
	})

	return e
}

// registerLifecycle wires the Echo server into the fx lifecycle.
func registerLifecycle(lc fx.Lifecycle, e *echo.Echo, cfg *config.Config, log *slog.Logger) {
	addr := cfg.Server.Addr
	if addr == "" {
		addr = ":8080"
	}

	lc.Append(fx.Hook{
		OnStart: func(_ context.Context) error {
			log.Info("HTTP server starting", "addr", addr)
			go func() {
				if err := e.Start(addr); err != nil && err != http.ErrServerClosed {
					log.Error("HTTP server error", "err", err)
				}
			}()
			return nil
		},
		OnStop: func(ctx context.Context) error {
			log.Info("HTTP server shutting down")
			shutCtx, cancel := context.WithTimeout(ctx, cfg.Server.ShutdownTimeout)
			defer cancel()
			if err := e.Shutdown(shutCtx); err != nil {
				return fmt.Errorf("server: shutdown: %w", err)
			}
			return nil
		},
	})
}
