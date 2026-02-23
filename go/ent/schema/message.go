package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

// Message stores a single Telegram message.
//
// NOTE: Vector embedding columns (content_vector_1536, content_vector_1024,
// content_vector_768) are NOT part of the ent schema because ent does not
// natively support the pgvector `vector` type.  Those columns are managed by
// the db package via raw SQL, and the VectorStore service handles reads and
// writes.  This keeps ent focused on structured data and avoids coupling the
// ORM to a Postgres-specific extension.
type Message struct {
	ent.Schema
}

// Fields defines the message table columns.
func (Message) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("id", uuid.UUID{}).
			Default(uuid.New).
			Immutable(),

		// owner_account_id is set on insert and never changed.
		field.UUID("owner_account_id", uuid.UUID{}),

		// in_chat_id references the parent chat (denormalized for query convenience).
		field.UUID("in_chat_id", uuid.UUID{}),

		// platform is always "telegram" for now.
		field.String("platform").Default("telegram"),

		// platform_message_id is Telegram's numeric message ID (as string).
		field.String("platform_message_id").NotEmpty(),

		// from_id is the sender's Telegram numeric ID.
		field.String("from_id").Default(""),

		// from_name is the display name of the sender at send time.
		field.String("from_name").Default(""),

		// content is the text body of the message.
		field.Text("content").Default(""),

		field.Bool("is_reply").Default(false),
		field.String("reply_to_id").Default(""),
		field.String("reply_to_name").Default(""),

		// platform_timestamp is the Unix second timestamp from Telegram.
		field.Int64("platform_timestamp").Default(0),

		// content_vector_model records which model produced the stored vector,
		// allowing incremental re-embedding when the model changes.
		field.String("content_vector_model").Default(""),

		// jieba_tokens is a JSON array of CJK tokens for keyword search fallback.
		field.JSON("jieba_tokens", []string{}).Optional(),

		field.Int64("created_at").
			Immutable().
			DefaultFunc(nowMs),

		field.Int64("updated_at").
			DefaultFunc(nowMs).
			UpdateDefault(nowMs),

		// deleted_at = 0 means not deleted; non-zero is a soft-delete timestamp.
		field.Int64("deleted_at").Default(0),
	}
}

// Edges declares that each Message belongs to one Account and one Chat.
func (Message) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("owner", Account.Type).
			Ref("messages").
			Field("owner_account_id").
			Required().
			Unique(),

		edge.From("chat", Chat.Type).
			Ref("messages").
			Field("in_chat_id").
			Required().
			Unique(),
	}
}

// Indexes mirrors the DB-level unique constraint and common query patterns.
func (Message) Indexes() []ent.Index {
	return []ent.Index{
		// One message per (account, chat, platform_message_id).
		index.Fields("owner_account_id", "in_chat_id", "platform_message_id").Unique(),
		// Hot path: filter by chat for sync-progress checks.
		index.Fields("in_chat_id", "platform_timestamp"),
	}
}

// nowMs returns the current Unix millisecond timestamp.
// Declared as a function so ent uses it as a DefaultFunc, not a static value.
func nowMs() int64 { return time.Now().UnixMilli() }
