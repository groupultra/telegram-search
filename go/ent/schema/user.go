package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

// User caches Telegram user metadata resolved during message processing.
// It is used to display sender information without re-fetching from the API.
type User struct {
	ent.Schema
}

// Fields defines the users table columns.
func (User) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("id", uuid.UUID{}).
			Default(uuid.New).
			Immutable(),

		// telegram_id is the numeric Telegram user ID.
		field.String("telegram_id").NotEmpty(),

		field.String("username").Default(""),
		field.String("first_name").Default(""),
		field.String("last_name").Default(""),

		// is_bot distinguishes bots from human users.
		field.Bool("is_bot").Default(false),

		field.Int64("created_at").
			Immutable().
			DefaultFunc(nowMs),

		field.Int64("updated_at").
			DefaultFunc(nowMs).
			UpdateDefault(nowMs),
	}
}

// Edges - User has no edges in the current schema; it is referenced by raw
// FROM_ID strings in Message.  A future migration can add a FK relation.
func (User) Edges() []ent.Edge { return nil }

// Indexes enforces the global uniqueness of Telegram user IDs.
func (User) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("telegram_id").Unique(),
	}
}
