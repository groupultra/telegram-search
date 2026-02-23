// Package config centralizes all runtime configuration via Viper.
//
// Configuration is loaded in this order (highest precedence first):
//  1. Environment variables (prefixed TGS_)
//  2. Config file (tgsearch.yaml or tgsearch.json in CWD / $HOME / /etc)
//  3. Built-in defaults
//
// NOTE: No config file is required; env vars alone are sufficient for
// containerized deployments.
package config

import (
	"fmt"
	"strings"
	"time"

	"github.com/spf13/viper"
	"go.uber.org/fx"
)

// Module provides *Config to the fx dependency graph.
var Module = fx.Module("config", fx.Provide(New))

// Config is the root configuration struct.
// All fields are optional unless marked required.
type Config struct {
	Database  DatabaseConfig  `mapstructure:"database"`
	Telegram  TelegramConfig  `mapstructure:"telegram"`
	Bot       BotConfig       `mapstructure:"bot"`
	Embedding EmbeddingConfig `mapstructure:"embedding"`
	Server    ServerConfig    `mapstructure:"server"`
}

// DatabaseConfig configures the PostgreSQL connection.
type DatabaseConfig struct {
	// DSN is a full postgres:// connection string.
	// When set, individual fields are ignored.
	DSN      string `mapstructure:"dsn"`
	Host     string `mapstructure:"host"`
	Port     int    `mapstructure:"port"`
	User     string `mapstructure:"user"`
	Password string `mapstructure:"password"`
	Name     string `mapstructure:"name"`
	// MaxConns limits the connection pool.
	MaxConns int32 `mapstructure:"max_conns"`
	// MinConns keeps this many connections warm.
	MinConns int32 `mapstructure:"min_conns"`
}

// DSNOrBuild returns the explicit DSN or constructs one from individual fields.
func (d DatabaseConfig) DSNOrBuild() string {
	if d.DSN != "" {
		return d.DSN
	}
	host := d.Host
	if host == "" {
		host = "localhost"
	}
	port := d.Port
	if port == 0 {
		port = 5432
	}
	user := d.User
	if user == "" {
		user = "postgres"
	}
	name := d.Name
	if name == "" {
		name = "telegram_search"
	}
	return fmt.Sprintf("postgres://%s:%s@%s:%d/%s?sslmode=disable",
		user, d.Password, host, port, name)
}

// TelegramConfig holds MTProto credentials for the user client.
// These are used only by the takeout / sync subsystem.
type TelegramConfig struct {
	// AppID and AppHash come from https://my.telegram.org/apps.
	AppID   int    `mapstructure:"app_id"`
	AppHash string `mapstructure:"app_hash"`
	// SessionFile is the path where the MTProto session is persisted.
	// Defaults to "./session.json".
	SessionFile string `mapstructure:"session_file"`
	// Phone is pre-filled during interactive auth in TUI mode.
	Phone string `mapstructure:"phone"`
	// ProxyURL is an optional socks5:// or http:// proxy.
	ProxyURL string `mapstructure:"proxy_url"`
}

// BotConfig configures the Telegram Bot API integration.
type BotConfig struct {
	// Token is the bot token from @BotFather. Required in server mode.
	Token string `mapstructure:"token"`
	// WebhookURL is the publicly-reachable HTTPS URL for the bot webhook.
	// When empty the bot falls back to long-polling (useful for local dev).
	WebhookURL string `mapstructure:"webhook_url"`
	// WebhookSecret is an optional header value that Telegram sends with each
	// webhook request so the server can verify its origin.
	WebhookSecret string `mapstructure:"webhook_secret"`
	// AllowedUsers restricts which Telegram user IDs may use the bot.
	// An empty slice disables the allowlist (all users are allowed).
	AllowedUsers []int64 `mapstructure:"allowed_users"`
}

// EmbeddingConfig configures the OpenAI-compatible embedding endpoint.
type EmbeddingConfig struct {
	// BaseURL is the API base URL. Defaults to https://api.openai.com/v1.
	BaseURL string `mapstructure:"base_url"`
	// APIKey is the bearer token.
	APIKey string `mapstructure:"api_key"`
	// Model is the embedding model identifier (e.g. text-embedding-3-small).
	Model string `mapstructure:"model"`
	// Dimension is the output vector dimension (768, 1024, or 1536).
	Dimension int `mapstructure:"dimension"`
	// BatchSize controls how many texts are embedded per API call.
	BatchSize int `mapstructure:"batch_size"`
	// Timeout for each embedding API call.
	Timeout time.Duration `mapstructure:"timeout"`
}

// ServerConfig configures the Echo HTTP server.
type ServerConfig struct {
	// Addr is the listen address (e.g. ":8080").
	Addr string `mapstructure:"addr"`
	// ShutdownTimeout allows in-flight requests to finish before exit.
	ShutdownTimeout time.Duration `mapstructure:"shutdown_timeout"`
}

// New reads configuration from environment and files, returning a validated
// *Config. It is safe to call multiple times; each call creates a fresh Viper
// instance so there are no global side-effects.
func New() (*Config, error) {
	v := viper.New()

	// NOTE: TGS_ prefix keeps vars scoped and avoids collisions with other
	// programs that might run in the same environment.
	v.SetEnvPrefix("TGS")
	v.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))
	v.AutomaticEnv()

	v.SetConfigName("tgsearch")
	v.SetConfigType("yaml")
	v.AddConfigPath(".")
	v.AddConfigPath("$HOME/.config/tgsearch")
	v.AddConfigPath("/etc/tgsearch")

	// Defaults
	v.SetDefault("database.host", "localhost")
	v.SetDefault("database.port", 5432)
	v.SetDefault("database.user", "postgres")
	v.SetDefault("database.name", "telegram_search")
	v.SetDefault("database.max_conns", 20)
	v.SetDefault("database.min_conns", 2)

	v.SetDefault("telegram.session_file", "./session.json")

	v.SetDefault("embedding.base_url", "https://api.openai.com/v1")
	v.SetDefault("embedding.model", "text-embedding-3-small")
	v.SetDefault("embedding.dimension", 1536)
	v.SetDefault("embedding.batch_size", 100)
	v.SetDefault("embedding.timeout", "30s")

	v.SetDefault("server.addr", ":8080")
	v.SetDefault("server.shutdown_timeout", "10s")

	// Config file is optional; ignore not-found errors.
	if err := v.ReadInConfig(); err != nil {
		var notFound viper.ConfigFileNotFoundError
		if !isConfigFileNotFoundError(err, &notFound) {
			return nil, fmt.Errorf("config: read config file: %w", err)
		}
	}

	var cfg Config
	if err := v.Unmarshal(&cfg); err != nil {
		return nil, fmt.Errorf("config: unmarshal: %w", err)
	}

	return &cfg, nil
}

// isConfigFileNotFoundError checks whether err is a Viper ConfigFileNotFoundError
// using a type-assertion instead of errors.As since Viper returns a value type.
func isConfigFileNotFoundError(err error, _ *viper.ConfigFileNotFoundError) bool {
	_, ok := err.(viper.ConfigFileNotFoundError) //nolint:errorlint // Viper returns value type
	return ok
}
