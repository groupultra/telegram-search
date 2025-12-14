import { sleep } from '@moeru/std'

export interface ConnOptions {
  onError?: (error: unknown) => void
  onClose?: () => void
  autoConnect?: boolean
  autoReconnect?: boolean
  maxReconnectAttempts?: number
}

export class Conn {
  url: Readonly<string>
  websocket?: WebSocket

  private connected = false
  private shouldClose = false

  private readonly opts: Required<ConnOptions>

  constructor(url: string, options: ConnOptions) {
    this.opts = {
      onError: () => {},
      onClose: () => {},
      autoConnect: true,
      autoReconnect: true,
      maxReconnectAttempts: -1,
      ...options,
    }

    if (this.opts.autoConnect) {
      void this.connect()
    }

    this.url = url
  }

  private async retryWithExponentialBackoff(fn: () => void | Promise<void>) {
    const { maxReconnectAttempts } = this.opts
    let attempts = 0

    // Loop until attempts exceed maxReconnectAttempts, or unlimited if -1
    while (true) {
      if (maxReconnectAttempts !== -1 && attempts >= maxReconnectAttempts) {
        console.error(`Maximum retry attempts (${maxReconnectAttempts}) reached`)
        return
      }

      try {
        await fn()
        return
      }
      catch (err) {
        this.opts.onError?.(err)
        const delay = Math.min(2 ** attempts * 1000, 30_000) // capped exponential backoff
        await sleep(delay)
        attempts++
      }
    }
  }

  private async tryReconnectWithExponentialBackoff() {
    if (this.shouldClose) {
      return
    }
    await this.retryWithExponentialBackoff(() => this._connect())
  }

  private _connect(): Promise<void> {
    if (this.shouldClose || this.connected) {
      return Promise.resolve()
    }

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.url)
      this.websocket = ws

      ws.onerror = (event: any) => {
        this.connected = false
        this.opts.onError?.(event)
        reject(event?.error ?? new Error('WebSocket error'))
      }

      ws.onclose = () => {
        if (this.connected) {
          this.connected = false
          this.opts.onClose?.()
        }
        if (this.opts.autoReconnect && !this.shouldClose) {
          void this.tryReconnectWithExponentialBackoff()
        }
      }

      ws.onopen = () => {
        this.connected = true
        resolve()
      }
    })
  }

  async connect() {
    await this.tryReconnectWithExponentialBackoff()
  }

  close(): void {
    this.shouldClose = true
    if (this.websocket) {
      this.websocket.close()
      this.connected = false
    }
  }
}
