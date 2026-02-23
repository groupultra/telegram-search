// Package bot wires the Telegram Bot API client and registers command handlers.
//
// The bot supports two operation modes:
//   - Webhook mode: Echo receives POST /webhook, passes updates to the bot.
//     Suitable for production; scales horizontally since updates are stateless.
//   - Long-polling mode: The bot polls for updates internally.
//     Useful for local development where a public URL is unavailable.
//
// Mode selection is automatic: if cfg.Bot.WebhookURL is non-empty, webhook
// mode is used; otherwise the bot falls back to long-polling.
package bot

import (
	"context"
	"fmt"
	"log/slog"

	telebot "github.com/go-telegram/bot"
	"github.com/go-telegram/bot/models"
	"github.com/labstack/echo/v4"
	"go.uber.org/fx"

	"github.com/groupultra/telegram-search/internal/bot/handler"
	"github.com/groupultra/telegram-search/internal/config"
	"github.com/groupultra/telegram-search/internal/search"
	syncsvc "github.com/groupultra/telegram-search/internal/sync"
)

// Module provides the bot and registers it with Echo's webhook route.
var Module = fx.Module("bot",
	fx.Provide(New),
	fx.Invoke(register),
)

// Bot wraps the go-telegram/bot client with application-level context.
type Bot struct {
	tg  *telebot.Bot
	log *slog.Logger
	cfg config.BotConfig
}

// New creates the Bot and registers all command handlers.
func New(
	cfg *config.Config,
	searchSvc *search.Service,
	syncSvc *syncsvc.Service,
	log *slog.Logger,
) (*Bot, error) {
	bc := cfg.Bot
	if bc.Token == "" {
		return nil, fmt.Errorf("bot: token is required (set TGS_BOT_TOKEN)")
	}

	opts := []telebot.Option{
		telebot.WithDefaultHandler(handler.Default(log)),
	}

	if bc.WebhookSecret != "" {
		opts = append(opts, telebot.WithWebhookSecretToken(bc.WebhookSecret))
	}

	tb, err := telebot.New(bc.Token, opts...)
	if err != nil {
		return nil, fmt.Errorf("bot: create client: %w", err)
	}

	// Register command handlers.
	tb.RegisterHandler(telebot.HandlerTypeMessageText, "/start", telebot.MatchTypeExact, handler.Start(log))
	tb.RegisterHandler(telebot.HandlerTypeMessageText, "/help", telebot.MatchTypeExact, handler.Help(log))
	tb.RegisterHandler(telebot.HandlerTypeMessageText, "/search", telebot.MatchTypePrefix, handler.Search(searchSvc, log))
	tb.RegisterHandler(telebot.HandlerTypeMessageText, "/sync", telebot.MatchTypeExact, handler.Sync(syncSvc, log))

	// Callback queries for search result pagination.
	tb.RegisterHandler(telebot.HandlerTypeCallbackQueryData, "search:", telebot.MatchTypePrefix, handler.SearchCallback(searchSvc, log))

	return &Bot{tg: tb, log: log.With("component", "bot"), cfg: bc}, nil
}

// register wires the bot into the fx lifecycle and Echo (for webhook mode).
func register(lc fx.Lifecycle, b *Bot, e *echo.Echo) {
	lc.Append(fx.Hook{
		OnStart: func(ctx context.Context) error {
			if b.cfg.WebhookURL != "" {
				return b.startWebhook(ctx, e)
			}
			return b.startPolling(ctx)
		},
	})
}

// startWebhook registers the Echo route and configures the Telegram webhook.
func (b *Bot) startWebhook(ctx context.Context, e *echo.Echo) error {
	const webhookPath = "/webhook"

	// Echo adapts the go-telegram/bot http.Handler.
	// NOTE: echo.WrapHandler converts an http.Handler to an echo.HandlerFunc.
	e.POST(webhookPath, echo.WrapHandler(b.tg.WebhookHandler()))

	webhookURL := b.cfg.WebhookURL + webhookPath
	b.log.Info("registering webhook", "url", webhookURL)

	if _, err := b.tg.SetWebhook(ctx, &telebot.SetWebhookParams{
		URL:         webhookURL,
		SecretToken: b.cfg.WebhookSecret,
	}); err != nil {
		return fmt.Errorf("bot: set webhook: %w", err)
	}

	// StartWebhook processes updates dispatched by the webhook handler above.
	go b.tg.StartWebhook(ctx)
	return nil
}

// startPolling starts long-polling (non-blocking; runs in a goroutine).
func (b *Bot) startPolling(ctx context.Context) error {
	b.log.Info("starting long-polling")
	go b.tg.Start(ctx)
	return nil
}

// DeleteWebhook removes the webhook registration from Telegram.
// Called on graceful shutdown so the next run starts cleanly.
func (b *Bot) DeleteWebhook(ctx context.Context) error {
	_, err := b.tg.DeleteWebhook(ctx, &telebot.DeleteWebhookParams{})
	if err != nil {
		return fmt.Errorf("bot: delete webhook: %w", err)
	}
	return nil
}

// SetWebhookParams is the parameter type for SetWebhook.
// Re-exported here so callers don't need to import go-telegram/bot directly.
type SetWebhookParams = telebot.SetWebhookParams

// Update is the Telegram update type.
// Re-exported here so callers don't need to import go-telegram/bot/models directly.
type Update = models.Update
