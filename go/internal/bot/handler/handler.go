// Package handler contains individual Telegram bot command handlers.
//
// Each handler function returns a telebot.HandlerFunc, keeping handlers
// composable and testable without a live bot instance.
//
// Handler responsibilities:
//   - Parse user input.
//   - Call the appropriate service.
//   - Format and send the reply.
//
// Handlers must not hold mutable state; all state is stored in the DB.
package handler

import (
	"context"
	"fmt"
	"log/slog"
	"strconv"
	"strings"
	"time"

	telebot "github.com/go-telegram/bot"
	"github.com/go-telegram/bot/models"

	"github.com/groupultra/telegram-search/internal/search"
	"github.com/groupultra/telegram-search/internal/sync"
)

const (
	// maxSearchResults is the page size for /search results.
	maxSearchResults = 10
	// maxContentPreview is the character limit for each message snippet.
	maxContentPreview = 200
)

// Default handles any update that doesn't match a registered command.
func Default(log *slog.Logger) telebot.HandlerFunc {
	return func(ctx context.Context, b *telebot.Bot, update *models.Update) {
		if update.Message == nil {
			return
		}
		// Only respond to unrecognized commands; ignore plain text.
		if strings.HasPrefix(update.Message.Text, "/") {
			sendText(ctx, b, update.Message.Chat.ID,
				"Unknown command. Type /help for available commands.")
		}
	}
}

// Start handles /start.
func Start(log *slog.Logger) telebot.HandlerFunc {
	return func(ctx context.Context, b *telebot.Bot, update *models.Update) {
		if update.Message == nil {
			return
		}

		msg := `*Telegram Search Bot*

I can search through your archived Telegram messages using semantic (AI-powered) search.

*Commands:*
/search <query> — search messages
/sync — sync your Telegram message history
/help — show this help

*Getting started:*
1. Run /sync to import your messages
2. Use /search <topic> to find conversations`

		sendMarkdown(ctx, b, update.Message.Chat.ID, msg)
	}
}

// Help handles /help (same content as /start for simplicity).
func Help(log *slog.Logger) telebot.HandlerFunc {
	return Start(log)
}

// Search handles /search <query> [--chat <chat_id>].
//
// Usage:
//
//	/search machine learning
//	/search golang --chat -1001234567
func Search(svc *search.Service, log *slog.Logger) telebot.HandlerFunc {
	return func(ctx context.Context, b *telebot.Bot, update *models.Update) {
		if update.Message == nil {
			return
		}

		text := strings.TrimSpace(update.Message.Text)
		// Remove the /search prefix.
		query := strings.TrimSpace(strings.TrimPrefix(text, "/search"))
		if query == "" {
			sendText(ctx, b, update.Message.Chat.ID,
				"Usage: /search <your query>\n\nExample: /search machine learning in Go")

			return
		}

		// Parse optional --chat flag.
		chatIDs, query := parseChatFlag(query)

		userID := update.Message.From.ID
		// NOTE: In a full implementation, resolve the accountID from the
		// Telegram user ID via the DB (accounts table lookup).
		// For now we use the user ID as a placeholder.
		accountID := strconv.FormatInt(userID, 10)

		results, err := svc.Search(ctx, query, search.Filter{
			AccountID: accountID,
			ChatIDs:   chatIDs,
		}, search.Opts{Limit: maxSearchResults})
		if err != nil {
			log.Error("search failed", "err", err)
			sendText(ctx, b, update.Message.Chat.ID, "Search failed. Please try again.")

			return
		}

		if len(results) == 0 {
			sendText(ctx, b, update.Message.Chat.ID,
				fmt.Sprintf("No results found for: *%s*", escapeMarkdown(query)))

			return
		}

		reply := formatSearchResults(query, results)
		sendMarkdown(ctx, b, update.Message.Chat.ID, reply)
	}
}

// SearchCallback handles inline keyboard pagination callbacks (search:page:<n>).
func SearchCallback(svc *search.Service, log *slog.Logger) telebot.HandlerFunc {
	return func(ctx context.Context, b *telebot.Bot, update *models.Update) {
		if update.CallbackQuery == nil {
			return
		}
		// NOTE: Full implementation would decode the query and page number from
		// the callback data, re-execute the search with an offset, and edit the
		// message.  Abbreviated here for clarity.
		if _, err := b.AnswerCallbackQuery(ctx, &telebot.AnswerCallbackQueryParams{
			CallbackQueryID: update.CallbackQuery.ID,
			Text:            "Loading...",
		}); err != nil {
			log.Warn("answer callback failed", "err", err)
		}
	}
}

// Sync handles /sync — starts a background message sync job.
func Sync(svc *sync.Service, log *slog.Logger) telebot.HandlerFunc {
	return func(ctx context.Context, b *telebot.Bot, update *models.Update) {
		if update.Message == nil {
			return
		}

		chatID := update.Message.Chat.ID
		userID := update.Message.From.ID
		accountID := strconv.FormatInt(userID, 10)

		sendText(ctx, b, chatID, "Starting sync... I'll update you as each chat completes.")

		// Progress channel; closed by svc.Run when done.
		progress := make(chan sync.Progress, 32)

		// Run sync in the background so we can send periodic updates.
		syncCtx, cancel := context.WithTimeout(context.Background(), 6*time.Hour)

		go func() {
			defer cancel()

			svc.Run(syncCtx, accountID, sync.SyncOpts{Incremental: true}, progress)
		}()

		go func() {
			for p := range progress {
				if p.Err != nil {
					sendText(ctx, b, chatID,
						fmt.Sprintf("⚠️ Error syncing %s: %v", p.ChatID, p.Err))

					continue
				}

				if p.Msg == "done" {
					sendText(ctx, b, chatID,
						fmt.Sprintf("✅ Synced %s (%d messages)", p.ChatName, p.Done))
				}
			}

			sendText(ctx, b, chatID, "✅ Sync complete!")
		}()
	}
}

// --- helpers -----------------------------------------------------------------

func sendText(ctx context.Context, b *telebot.Bot, chatID int64, text string) {
	if _, err := b.SendMessage(ctx, &telebot.SendMessageParams{
		ChatID: chatID,
		Text:   text,
	}); err != nil {
		// Log but don't propagate; send failures are non-fatal.
		_ = err
	}
}

func sendMarkdown(ctx context.Context, b *telebot.Bot, chatID int64, text string) {
	if _, err := b.SendMessage(ctx, &telebot.SendMessageParams{
		ChatID:    chatID,
		Text:      text,
		ParseMode: models.ParseModeMarkdown,
	}); err != nil {
		_ = err
	}
}

// formatSearchResults builds a Markdown-formatted message from search results.
func formatSearchResults(query string, results []search.Result) string {
	var sb strings.Builder
	fmt.Fprintf(&sb, "*Search results for:* %s\n\n", escapeMarkdown(query))

	for i, r := range results {
		content := r.Content
		if len(content) > maxContentPreview {
			content = content[:maxContentPreview] + "…"
		}

		ts := time.Unix(r.PlatformTimestamp, 0).Format("2006-01-02")

		chat := r.ChatName
		if chat == "" {
			chat = r.InChatID
		}

		fmt.Fprintf(&sb, "*%d.* [%s] %s (%s)\n%s\n\n",
			i+1,
			escapeMarkdown(chat),
			escapeMarkdown(r.FromName),
			ts,
			escapeMarkdown(content),
		)
	}

	return sb.String()
}

// parseChatFlag extracts --chat <id> from the query string.
// Returns (chatIDs, remainingQuery).
func parseChatFlag(query string) ([]string, string) {
	parts := strings.Fields(query)
	var chatIDs []string
	var remaining []string

	for i := 0; i < len(parts); i++ {
		if parts[i] == "--chat" && i+1 < len(parts) {
			chatIDs = append(chatIDs, parts[i+1])
			i++ // skip the value
		} else {
			remaining = append(remaining, parts[i])
		}
	}

	return chatIDs, strings.Join(remaining, " ")
}

// escapeMarkdown escapes Telegram MarkdownV1 special characters.
func escapeMarkdown(s string) string {
	s = strings.ReplaceAll(s, "_", "\\_")
	s = strings.ReplaceAll(s, "*", "\\*")
	s = strings.ReplaceAll(s, "`", "\\`")
	s = strings.ReplaceAll(s, "[", "\\[")

	return s
}
