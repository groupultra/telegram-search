// Package tgclient manages the MTProto connection to Telegram using gotd/td.
//
// It defines the TelegramClient interface used by sync, TUI, and other packages,
// ensuring those packages do NOT directly import gotd/td types.
// Only this package imports gotd/td, keeping the MTProto dependency contained.
//
// Session persistence:
//   - Sessions are stored as JSON files at cfg.Telegram.SessionFile.
//   - On first run the session file will not exist; the caller must trigger
//     interactive authentication via AuthPhone + AuthCode.
//   - Once authenticated the session is saved automatically by gotd's session
//     storage layer.
package tgclient

import (
	"context"
	"fmt"
	"os"
	"path/filepath"

	"log/slog"

	"github.com/gotd/td/session"
	"github.com/gotd/td/telegram"
	"github.com/gotd/td/telegram/auth"
	"github.com/gotd/td/tg"
	"go.uber.org/fx"
	"go.uber.org/zap"

	"github.com/groupultra/telegram-search/internal/config"
)

// NOTE: auth.SentCode does not exist in gotd/td; the correct type returned by
// SendCode is tg.AuthSentCodeClass (an interface). We wrap it in our own
// SentCode so callers outside this package don't import tg directly.

// Module provides *Client to the fx graph.
var Module = fx.Module("tgclient", fx.Provide(New))

// --- Domain types (no gotd/td types) ----------------------------------------

// TGMessage is a domain-level representation of a Telegram message.
// It is used by callers so they don't need to import gotd/td types.
type TGMessage struct {
	ID        int
	FromID    string
	Text      string
	Date      int // Unix timestamp
}

// TGDialog is a domain-level representation of a Telegram dialog.
type TGDialog struct {
	ID   string
	Name string
	Type string // "user" | "group" | "channel"
}

// SentCode wraps tg.AuthSentCodeClass without exposing it.
// Callers hold this as an opaque token to pass back to AuthWithCode.
type SentCode struct {
	inner tg.AuthSentCodeClass
}

// --- Interface ---------------------------------------------------------------

// API is the interface that sync and TUI packages depend on.
// Keeping it here (close to the implementation) avoids a separate types package.
type API interface {
	// IsAuthenticated reports whether the client has an active session.
	IsAuthenticated() bool
	// WaitReady blocks until authenticated or ctx is cancelled.
	WaitReady(ctx context.Context) error
	// AuthWithPhone sends an auth code to the given phone number.
	AuthWithPhone(ctx context.Context, phone string) (*SentCode, error)
	// AuthWithCode submits the received auth code.
	AuthWithCode(ctx context.Context, phone, code string, sent *SentCode) error
	// AuthWithPassword submits a 2FA cloud password.
	AuthWithPassword(ctx context.Context, password string) error
	// GetDialogs returns the account's dialog list.
	GetDialogs(ctx context.Context) ([]TGDialog, error)
	// GetHistory returns messages for a peer, offset by offsetID.
	GetHistory(ctx context.Context, chatID string, offsetID, limit int) ([]TGMessage, error)
}

// --- Concrete implementation -------------------------------------------------

// Client wraps the gotd telegram.Client with session management.
type Client struct {
	raw   *telegram.Client
	api   *tg.Client
	cfg   config.TelegramConfig
	log   *slog.Logger
	ready chan struct{}
}

// New constructs the Client. The TCP connection is not established until Run is called.
func New(lc fx.Lifecycle, cfg *config.Config, log *slog.Logger) (*Client, error) {
	tc := cfg.Telegram
	if tc.AppID == 0 || tc.AppHash == "" {
		return nil, fmt.Errorf("tgclient: telegram.app_id and telegram.app_hash are required")
	}

	sessionPath := tc.SessionFile
	if sessionPath == "" {
		sessionPath = "./session.json"
	}
	if err := os.MkdirAll(filepath.Dir(sessionPath), 0o700); err != nil {
		return nil, fmt.Errorf("tgclient: create session dir: %w", err)
	}

	store := &session.FileStorage{Path: sessionPath}
	// NOTE: gotd/td requires a *zap.Logger; create a minimal warn-level one
	// to suppress gotd's verbose debug output. This is the only zap usage
	// in the codebase — everywhere else we use log/slog.
	gotdLog, _ := zap.NewProduction()
	gotdLog = gotdLog.WithOptions(zap.IncreaseLevel(zap.WarnLevel))
	raw := telegram.NewClient(tc.AppID, tc.AppHash, telegram.Options{
		SessionStorage: store,
		Logger:         gotdLog.Named("gotd"),
	})

	c := &Client{
		raw:   raw,
		cfg:   tc,
		log:   log.With("component", "tgclient"),
		ready: make(chan struct{}),
	}
	_ = lc
	return c, nil
}

// Run starts the MTProto event loop (call in a dedicated goroutine).
// onReady is invoked once the session is authenticated.
func (c *Client) Run(ctx context.Context, onReady func()) error {
	return c.raw.Run(ctx, func(ctx context.Context) error {
		c.api = c.raw.API()

		status, err := c.raw.Auth().Status(ctx)
		if err != nil {
			return fmt.Errorf("tgclient: auth status: %w", err)
		}

		if status.Authorized {
			c.log.Info("session restored; client ready")
			select {
			case <-c.ready:
			default:
				close(c.ready)
			}
			if onReady != nil {
				onReady()
			}
		} else {
			c.log.Info("not authenticated; waiting for interactive auth")
		}

		<-ctx.Done()
		return nil
	})
}

// IsAuthenticated reports whether the client has an active session.
func (c *Client) IsAuthenticated() bool {
	select {
	case <-c.ready:
		return true
	default:
		return false
	}
}

// WaitReady blocks until the client is authenticated or ctx is cancelled.
func (c *Client) WaitReady(ctx context.Context) error {
	select {
	case <-c.ready:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

// AuthWithPhone initiates phone-number authentication.
func (c *Client) AuthWithPhone(ctx context.Context, phone string) (*SentCode, error) {
	sent, err := c.raw.Auth().SendCode(ctx, phone, auth.SendCodeOptions{})
	if err != nil {
		return nil, fmt.Errorf("tgclient: send code: %w", err)
	}
	return &SentCode{inner: sent}, nil
}

// AuthWithCode submits the received auth code.
func (c *Client) AuthWithCode(ctx context.Context, phone, code string, sent *SentCode) error {
	// AuthSentCodeClass is either *tg.AuthSentCode or *tg.AuthSentCodeSuccess.
	// Only the former carries the PhoneCodeHash needed for SignIn.
	sc, ok := sent.inner.(*tg.AuthSentCode)
	if !ok {
		return fmt.Errorf("tgclient: unexpected sent code type: %T", sent.inner)
	}
	if _, err := c.raw.Auth().SignIn(ctx, phone, code, sc.PhoneCodeHash); err != nil {
		return fmt.Errorf("tgclient: sign in: %w", err)
	}
	c.markReady()
	return nil
}

// AuthWithPassword submits a 2FA cloud password.
func (c *Client) AuthWithPassword(ctx context.Context, password string) error {
	if _, err := c.raw.Auth().Password(ctx, password); err != nil {
		return fmt.Errorf("tgclient: 2fa password: %w", err)
	}
	c.markReady()
	return nil
}

// GetDialogs returns the account's dialog list.
func (c *Client) GetDialogs(ctx context.Context) ([]TGDialog, error) {
	dialogs, err := c.api.MessagesGetDialogs(ctx, &tg.MessagesGetDialogsRequest{
		Limit:      100,
		OffsetPeer: &tg.InputPeerEmpty{},
	})
	if err != nil {
		return nil, fmt.Errorf("tgclient: get dialogs: %w", err)
	}

	var result []TGDialog
	switch v := dialogs.(type) {
	case *tg.MessagesDialogs:
		result = append(result, mapChats(v.Chats)...)
		result = append(result, mapUsers(v.Users)...)
	case *tg.MessagesDialogsSlice:
		result = append(result, mapChats(v.Chats)...)
		result = append(result, mapUsers(v.Users)...)
	}
	return result, nil
}

// GetHistory fetches up to limit messages for the given chat, offset by offsetID.
func (c *Client) GetHistory(ctx context.Context, chatID string, offsetID, limit int) ([]TGMessage, error) {
	// NOTE: A full implementation resolves chatID to the correct InputPeer type
	// and access hash from the DB entity cache.  This stub returns an empty result
	// until the entity cache is wired up.
	_ = chatID

	result, err := c.api.MessagesGetHistory(ctx, &tg.MessagesGetHistoryRequest{
		Peer:     &tg.InputPeerEmpty{},
		OffsetID: offsetID,
		Limit:    limit,
	})
	if err != nil {
		return nil, fmt.Errorf("tgclient: get history: %w", err)
	}

	var messages []TGMessage
	switch v := result.(type) {
	case *tg.MessagesMessages:
		messages = mapMessages(v.Messages)
	case *tg.MessagesMessagesSlice:
		messages = mapMessages(v.Messages)
	case *tg.MessagesChannelMessages:
		messages = mapMessages(v.Messages)
	}
	return messages, nil
}

func (c *Client) markReady() {
	select {
	case <-c.ready:
	default:
		close(c.ready)
	}
}

// --- Mapping helpers ---------------------------------------------------------

func mapChats(chats []tg.ChatClass) []TGDialog {
	var out []TGDialog
	for _, c := range chats {
		switch v := c.(type) {
		case *tg.Chat:
			out = append(out, TGDialog{ID: fmt.Sprintf("%d", v.ID), Name: v.Title, Type: "group"})
		case *tg.Channel:
			t := "channel"
			if v.Megagroup {
				t = "supergroup"
			}
			out = append(out, TGDialog{ID: fmt.Sprintf("%d", v.ID), Name: v.Title, Type: t})
		}
	}
	return out
}

func mapUsers(users []tg.UserClass) []TGDialog {
	var out []TGDialog
	for _, u := range users {
		if user, ok := u.(*tg.User); ok && !user.Bot {
			name := user.FirstName + " " + user.LastName
			out = append(out, TGDialog{ID: fmt.Sprintf("%d", user.ID), Name: name, Type: "user"})
		}
	}
	return out
}

func mapMessages(raw []tg.MessageClass) []TGMessage {
	var out []TGMessage
	for _, m := range raw {
		msg, ok := m.(*tg.Message)
		if !ok || msg.Message == "" {
			continue
		}
		fromID := ""
		if msg.FromID != nil {
			if p, ok := msg.FromID.(*tg.PeerUser); ok {
				fromID = fmt.Sprintf("%d", p.UserID)
			}
		}
		out = append(out, TGMessage{
			ID:     msg.ID,
			FromID: fromID,
			Text:   msg.Message,
			Date:   msg.Date,
		})
	}
	return out
}

// Verify that *Client implements the API interface at compile time.
var _ API = (*Client)(nil)
