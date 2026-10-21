import type { LLMMessage } from '../useAIChat'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { LLM_PROVIDERS } from '../../../../../packages/core/src/llm-providers'
import { useAIChatLogic } from '../useAIChat'

const usage = { prompt_tokens: 4, completion_tokens: 2, total_tokens: 6 }
const messages: LLMMessage[] = [{ role: 'user', content: 'Hello' }]
const minimax = LLM_PROVIDERS.minimax
const cases = [
  { name: 'MiniMax default', apiBase: minimax.apiBase, model: minimax.defaultModel },
  { name: 'MiniMax alternative', apiBase: minimax.apiBase, model: minimax.models[1] },
  { name: 'saved legacy model', apiBase: minimax.apiBase, model: 'MiniMax-M2.7' },
  { name: 'custom model', apiBase: 'https://example.com/v1', model: 'custom-model' },
  { name: 'saved regional endpoint', apiBase: 'https://api.minimaxi.com/v1', model: minimax.defaultModel },
  { name: 'existing provider', apiBase: LLM_PROVIDERS.openai.apiBase, model: LLM_PROVIDERS.openai.defaultModel },
]

function completion(message = { role: 'assistant', content: 'Hello back' }, finishReason = 'stop') {
  return Response.json({
    id: 'test-completion',
    object: 'chat.completion',
    created: 0,
    choices: [{ index: 0, message, finish_reason: finishReason }],
    usage,
  })
}

function streamCompletion() {
  const chunks = [
    { choices: [{ index: 0, delta: { role: 'assistant', content: 'Hello back' }, finish_reason: null }] },
    { choices: [{ index: 0, delta: {}, finish_reason: 'stop' }], usage },
  ]
  return new Response(`${chunks.map(chunk => `data: ${JSON.stringify(chunk)}\n\n`).join('')}data: [DONE]\n\n`, {
    headers: { 'Content-Type': 'text/event-stream' },
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('AI chat HTTP requests', () => {
  // Keep the real xsai serializer: a mocked SDK would miss wire-format regressions.
  it.each(cases)('preserves $name in non-streaming requests', async ({ apiBase, model }) => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(completion())
    vi.stubGlobal('fetch', fetch)
    const config = { apiBase, model, apiKey: 'offline-test-key' }
    const onText = vi.fn()
    const onComplete = vi.fn()

    await useAIChatLogic().callLLMWithTools(config, messages, [], vi.fn(), vi.fn(), onText, onComplete)

    expect(fetch).toHaveBeenCalledTimes(1)
    const [url, init] = fetch.mock.calls[0]
    expect(String(url)).toBe(`${apiBase}/chat/completions`)
    expect(init?.method).toBe('POST')
    expect(JSON.parse(String(init?.body))).toEqual({
      model,
      messages,
      tools: [],
      temperature: 0.7,
      stream: false,
    })
    expect(config.model).toBe(model)
    expect(onText).toHaveBeenCalledWith('Hello back')
    expect(onComplete).toHaveBeenCalledWith({ promptTokens: 4, completionTokens: 2, totalTokens: 6 })
  })

  it.each(cases)('preserves $name in streaming requests', async ({ apiBase, model }) => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(streamCompletion())
    vi.stubGlobal('fetch', fetch)
    const onText = vi.fn()

    await useAIChatLogic().streamSimpleText({ apiBase, model, apiKey: 'offline-test-key', maxTokens: 2000 }, messages, onText)

    expect(fetch).toHaveBeenCalledTimes(1)
    const [url, init] = fetch.mock.calls[0]
    expect(String(url)).toBe(`${apiBase}/chat/completions`)
    expect(init?.method).toBe('POST')
    expect(JSON.parse(String(init?.body))).toMatchObject({ model, messages, max_tokens: 2000, stream: true })
    const body = JSON.parse(String(init?.body))
    // Omission uses MiniMax's adaptive thinking and default effort without unsupported overrides.
    for (const key of ['thinking', 'reasoning_effort', 'reasoning_split', 'service_tier']) {
      expect(body).not.toHaveProperty(key)
    }
    expect(onText).toHaveBeenCalledWith('Hello back')
  })

  it('preserves complete assistant reasoning and tool history in the next HTTP request', async () => {
    const assistant = {
      role: 'assistant',
      content: '<think>Preserve this content</think>',
      reasoning_content: 'Preserve separate reasoning too',
      tool_calls: [{ id: 'call-1', type: 'function', function: { name: 'lookup', arguments: '{}' } }],
    }
    const fetch = vi.fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(completion(assistant, 'tool_calls'))
      .mockResolvedValueOnce(completion())
    vi.stubGlobal('fetch', fetch)
    const toolContent = [
      { type: 'text', text: 'Found it' },
      { type: 'image_url', image_url: { url: 'https://example.com/photo.png' } },
    ]
    const execute = vi.fn().mockResolvedValue(toolContent)
    const tools = [{ type: 'function', function: { name: 'lookup', parameters: { type: 'object', properties: {} } }, execute }]

    await useAIChatLogic().callLLMWithTools(
      { apiBase: minimax.apiBase, model: minimax.defaultModel, apiKey: 'offline-test-key' },
      messages,
      tools,
      vi.fn(),
      vi.fn(),
      vi.fn(),
      vi.fn(),
    )

    expect(fetch).toHaveBeenCalledTimes(2)
    const body = JSON.parse(String(fetch.mock.calls[1][1]?.body))
    expect(body.model).toBe('MiniMax-M3.1-Flash')
    expect(body.messages).toEqual([...messages, assistant, { role: 'tool', tool_call_id: 'call-1', content: toolContent }])
    expect(body.tools).toEqual([{ type: 'function', function: tools[0].function }])
    expect(execute).toHaveBeenCalledTimes(1)
  })
})
