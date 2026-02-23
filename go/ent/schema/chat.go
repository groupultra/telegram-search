package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

// ChatType enumerates the Telegram chat kinds.
type ChatType string

const (
	ChatTypeUser      ChatType = "user"
	ChatTypeGroup     ChatType = "group"
	ChatTypeSupergroup ChatType = "supergroup"
	ChatTypeChannel   ChatType = "channel"
	ChatTypeBot       ChatType = "bot"
)

// Chat represents a Telegram dialog (user, group, channel).
type Chat struct {
	ent.Schema
}

// Fields defines the chat table columns.
func (Chat) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("id", uuid.UUID{}).
			Default(uuid.New).
			Immutable(),

		// owner_account_id links this chat to a specific account.
		field.UUID("owner_account_id", uuid.UUID{}),

		// platform is always "telegram" for now; kept for future extensibility.
		field.String("platform").Default("telegram"),

		// chat_id is the Telegram numeric peer ID (as string to handle int64 precision).
		field.String("chat_id").NotEmpty(),

		// chat_name is the display name at the time of last sync.
		field.String("chat_name").Default(""),

		field.String("chat_type").
			Default(string(ChatTypeGroup)),

		// chat_username is the @handle, if any (channels/supergroups often have one).
		field.String("chat_username").Optional().Nillable(),

		// note is a user-defined annotation for the chat.
		field.Text("note").Default(""),

		field.Int64("created_at").
			Immutable().
			DefaultFunc(nowMs),

		field.Int64("updated_at").
			DefaultFunc(nowMs).
			UpdateDefault(nowMs),
	}
}

// Edges declares relationships: each Chat belongs to one Account.
func (Chat) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("owner", Account.Type).
			Ref("chats").
			Field("owner_account_id").
			Required().
			Unique(),

		edge.To("messages", Message.Type),
	}
}

// Indexes enforces the (account, chat_id) uniqueness constraint so each account
// stores a chat exactly once.
func (Chat) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("owner_account_id", "chat_id").Unique(),
	}
}
