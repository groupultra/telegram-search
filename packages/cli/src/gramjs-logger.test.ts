import { LogLevel } from 'telegram/extensions/Logger.js'
import { describe, expect, it, vi } from 'vitest'

import { createGramJsStderrLogger } from './gramjs-logger'

describe('gramJS CLI logger', () => {
  it('writes remote client logs to stderr so stdout remains JSON-only', () => {
    // GramJS defaults to console.log, which polluted the Agent-facing JSON stream.
    const write = vi.fn(() => true)
    const logger = createGramJsStderrLogger({ write })

    logger.info('Connected')

    expect(write).toHaveBeenCalledOnce()
    expect(write).toHaveBeenCalledWith(expect.stringContaining('[INFO] - [Connected]'))
    expect(logger.logLevel).toBe(LogLevel.INFO)
  })
})
