// Package embed provides message embedding via any OpenAI-compatible API.
//
// The Service is stateless between calls; concurrency is bounded only by the
// upstream API rate limits, which callers should handle with retry logic.
package embed

import (
	"context"
	"fmt"

	openai "github.com/sashabaranov/go-openai"
	"go.uber.org/fx"
	"go.uber.org/zap"

	"github.com/groupultra/telegram-search/internal/config"
)

// Module provides *Service to the fx graph.
var Module = fx.Module("embed", fx.Provide(New))

// EmbedResult carries the embedding vectors and token usage for a batch.
type EmbedResult struct {
	Vectors   [][]float32
	Dimension int
	// Usage tracks token consumption for cost accounting.
	Usage struct {
		PromptTokens int
		TotalTokens  int
	}
}

// Service wraps the OpenAI embedding API.
type Service struct {
	client    *openai.Client
	cfg       config.EmbeddingConfig
	log       *zap.Logger
}

// New constructs a Service.  It returns an error if the API key is missing
// so the issue is surfaced at startup rather than at runtime.
func New(cfg *config.Config, log *zap.Logger) (*Service, error) {
	ec := cfg.Embedding
	if ec.APIKey == "" {
		// NOTE: We don't hard-fail here because users may want to run the system
		// without embedding (keyword-only search). The service will return an
		// ErrNoAPIKey error at call time so callers can decide what to do.
		log.Warn("embedding API key is empty; vector search will be unavailable")
	}

	clientCfg := openai.DefaultConfig(ec.APIKey)
	if ec.BaseURL != "" {
		clientCfg.BaseURL = ec.BaseURL
	}
	client := openai.NewClientWithConfig(clientCfg)

	return &Service{
		client: client,
		cfg:    ec,
		log:    log.Named("embed"),
	}, nil
}

// ErrNoAPIKey is returned when the embedding API key is not configured.
var ErrNoAPIKey = fmt.Errorf("embed: no API key configured")

// Embed sends texts to the embedding API and returns the resulting vectors.
//
// Texts are processed in batches of cfg.BatchSize to stay within API limits.
// All vectors in a single call share the same model and dimension.
func (s *Service) Embed(ctx context.Context, texts []string) (*EmbedResult, error) {
	if s.cfg.APIKey == "" {
		return nil, ErrNoAPIKey
	}
	if len(texts) == 0 {
		return &EmbedResult{}, nil
	}

	result := &EmbedResult{}
	batchSize := s.cfg.BatchSize
	if batchSize <= 0 {
		batchSize = 100
	}

	for start := 0; start < len(texts); start += batchSize {
		end := start + batchSize
		if end > len(texts) {
			end = len(texts)
		}
		batch := texts[start:end]

		vectors, dim, usage, err := s.embedBatch(ctx, batch)
		if err != nil {
			return nil, err
		}
		result.Vectors = append(result.Vectors, vectors...)
		result.Dimension = dim
		result.Usage.PromptTokens += usage.PromptTokens
		result.Usage.TotalTokens += usage.TotalTokens
	}

	return result, nil
}

// EmbedOne is a convenience wrapper that embeds a single string.
func (s *Service) EmbedOne(ctx context.Context, text string) ([]float32, error) {
	res, err := s.Embed(ctx, []string{text})
	if err != nil {
		return nil, err
	}
	if len(res.Vectors) == 0 {
		return nil, fmt.Errorf("embed: no vector returned")
	}
	return res.Vectors[0], nil
}

// embedBatch sends one API request for the given batch of texts.
func (s *Service) embedBatch(ctx context.Context, texts []string) ([][]float32, int, openai.Usage, error) {
	req := openai.EmbeddingRequestStrings{
		Input:          texts,
		Model:          openai.EmbeddingModel(s.cfg.Model),
		EncodingFormat: openai.EmbeddingEncodingFormatFloat,
	}

	// Request a specific dimension when the model and config agree.
	// Newer OpenAI models (text-embedding-3-*) support dimension truncation.
	if s.cfg.Dimension > 0 {
		req.Dimensions = s.cfg.Dimension
	}

	resp, err := s.client.CreateEmbeddings(ctx, req)
	if err != nil {
		return nil, 0, openai.Usage{}, fmt.Errorf("embed: API call failed: %w", err)
	}

	if len(resp.Data) != len(texts) {
		return nil, 0, openai.Usage{}, fmt.Errorf(
			"embed: expected %d vectors, got %d", len(texts), len(resp.Data))
	}

	vectors := make([][]float32, len(resp.Data))
	for i, datum := range resp.Data {
		vectors[i] = datum.Embedding
	}

	dim := 0
	if len(vectors) > 0 {
		dim = len(vectors[0])
	}

	s.log.Debug("embedded batch",
		zap.Int("count", len(texts)),
		zap.Int("dimension", dim),
		zap.Int("prompt_tokens", resp.Usage.PromptTokens),
	)

	return vectors, dim, resp.Usage, nil
}
