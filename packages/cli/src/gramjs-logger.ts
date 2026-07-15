import process from 'node:process'

import { Logger, LogLevel } from 'telegram/extensions/Logger.js'

interface TextWriter {
  write: (text: string) => unknown
}

class GramJsStderrLogger extends Logger {
  constructor(private readonly writer: TextWriter) {
    super(LogLevel.INFO)
  }

  override log(level: LogLevel, message: string, _color: string): void {
    this.writer.write(`${this.format(message, level)}\n`)
  }
}

export function createGramJsStderrLogger(writer: TextWriter = process.stderr): Logger {
  return new GramJsStderrLogger(writer)
}
