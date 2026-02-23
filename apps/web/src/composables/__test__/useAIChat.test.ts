import { tool } from '@xsai/tool'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import * as v from 'valibot'

import { useAIChatLogic } from '../useAIChat'

const mockedGenerateText = vi.fn()

vi.mock('xsai', () => ({
  generateText: (...args: unknown[]) => mockedGenerateText(...args),
  streamText: vi.fn(),
}))

describe('useAIChat.callLLMWithTools', () => {
  beforeEach(() => {
    mockedGenerateText.mockReset()
  })

  it('executes one generateText request and reports measured duration', async () => {
    let nowIndex = 0
    const nowValues = [1000, 1100, 1200]
    const nowSpy = vi.spyOn(Date, 'now').mockImplementation(() => {
      const value = nowValues[nowIndex] ?? nowValues[nowValues.length - 1]
      nowIndex += 1
      return value
    })

    mockedGenerateText.mockResolvedValue({
      steps: [
        {
          toolCalls: [{ toolName: 'searchMessages', args: { query: 'hello' } }],
          toolResults: [{ toolName: 'searchMessages', result: { ok: true } }],
        },
      ],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 20,
        total_tokens: 30,
      },
      finishReason: 'stop',
      text: 'final answer',
    })

    const logic = useAIChatLogic()
    const onToolCall = vi.fn()
    const onToolResult = vi.fn()
    const onTextDelta = vi.fn()
    const onComplete = vi.fn()
    const searchMessagesTool = await tool({
      name: 'searchMessages',
      description: 'search',
      parameters: v.strictObject({
        query: v.string(),
      }),
      execute: async () => JSON.stringify({ ok: true }),
    })

    await logic.callLLMWithTools(
      {
        apiBase: 'https://example.com/v1',
        apiKey: 'key',
        model: 'model',
      },
      [{ role: 'user', content: 'hi' }],
      [searchMessagesTool],
      onToolCall,
      onToolResult,
      onTextDelta,
      onComplete,
    )

    expect(mockedGenerateText).toHaveBeenCalledTimes(1)
    expect(onToolCall).toHaveBeenCalledTimes(1)
    expect(onToolResult).toHaveBeenCalledWith('searchMessages', { ok: true }, 100)
    expect(onTextDelta).toHaveBeenCalledWith('final answer')
    expect(onComplete).toHaveBeenCalledWith({
      promptTokens: 10,
      completionTokens: 20,
      totalTokens: 30,
    })

    nowSpy.mockRestore()
  })
})
