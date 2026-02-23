package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"github.com/google/uuid"
)

// Account holds a Telegram user account and its per-account settings.
// Each Account owns a set of Messages and Chats.
type Account struct {
	ent.Schema
}

// Fields defines the column layout for the accounts table.
func (Account) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("id", uuid.UUID{}).
			Default(uuid.New).
			Immutable(),

		// phone is the international format number used to identify the account.
		field.String("phone").
			NotEmpty().
			Unique(),

		// session_data is a JSON blob produced by gotd's session storage.
		// It must be treated as a secret (never log the full value).
		field.Text("session_data").
			Default("").
			Sensitive(),

		// settings is a JSON blob that maps to AccountSettings.
		// Stored as raw JSON so we can evolve the shape without migrations.
		field.JSON("settings", &AccountSettings{}).
			Optional(),

		// pts, qts, seq, date are MTProto update counters used for incremental sync.
		field.Int("pts").Default(0),
		field.Int("qts").Default(0),
		field.Int("seq").Default(0),
		field.Int("date").Default(0),

		// last_sync_at is a Unix millisecond timestamp of the last successful sync.
		field.Int64("last_sync_at").Default(0),

		field.Int64("created_at").
			Immutable().
			DefaultFunc(nowMs),

		field.Int64("updated_at").
			DefaultFunc(nowMs).
			UpdateDefault(nowMs),
	}
}

// Edges declares the one-to-many relationships.
func (Account) Edges() []ent.Edge {
	return []ent.Edge{
		edge.To("messages", Message.Type),
		edge.To("chats", Chat.Type),
	}
}

// AccountSettings is the per-account settings blob stored in accounts.settings.
type AccountSettings struct {
	Embedding EmbeddingSettings `json:"embedding"`
	Bot       BotSettings       `json:"bot"`
}

// EmbeddingSettings mirrors the embedding sub-config but is stored per account
// so different accounts may use different models/keys.
type EmbeddingSettings struct {
	Model     string `json:"model"`
	Dimension int    `json:"dimension"`
	APIKey    string `json:"apiKey"`
	APIBase   string `json:"apiBase"`
	BatchSize int    `json:"batchSize"`
}

// BotSettings controls bot-specific behaviour for this account.
type BotSettings struct {
	Enabled          bool   `json:"enabled"`
	LastSearchChatID string `json:"lastSearchChatId,omitempty"`
}
