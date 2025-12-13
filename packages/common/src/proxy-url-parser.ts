import type { ProxyConfig } from './config-schema'

import { SocksType } from './config-schema'

export interface ParsedProxyUrl {
  protocol: 'socks4' | 'socks5' | 'http' | 'mtproxy'
  host: string
  port: number
  username?: string
  password?: string
  secret?: string
  timeout?: number
}

/**
 * Parse a proxy URL into a ProxyConfig object
 * Supported formats:
 * - socks4://username:password@host:port?timeout=15
 * - socks5://username:password@host:port?timeout=15
 * - http://username:password@host:port?timeout=15
 * - mtproxy://secret@host:port?timeout=15
 *
 * @param proxyUrl The proxy URL to parse
 * @returns ProxyConfig object or null if parsing fails
 */
export function parseProxyUrl(proxyUrl: string): ProxyConfig | null {
  try {
    const url = new URL(proxyUrl)

    const protocol = url.protocol.slice(0, -1) // Remove trailing ':'
    if (!['socks4', 'socks5', 'http', 'mtproxy'].includes(protocol)) {
      return null
    }

    const host = url.hostname
    const port = Number.parseInt(url.port, 10)

    if (!host || !port || Number.isNaN(port)) {
      return null
    }

    const config: ProxyConfig = {
      ip: host,
      port,
    }

    // Parse timeout from query parameters
    const timeoutParam = url.searchParams.get('timeout')
    if (timeoutParam) {
      const timeout = Number.parseInt(timeoutParam, 10)
      if (!Number.isNaN(timeout) && timeout > 0) {
        config.timeout = timeout
      }
    }

    switch (protocol) {
      case 'socks4':
        config.socksType = SocksType.SOCKS4
        if (url.username)
          config.username = decodeURIComponent(url.username)
        if (url.password)
          config.password = decodeURIComponent(url.password)
        break

      case 'socks5':
      case 'http': // Default to SOCKS5 for HTTP proxy
        config.socksType = SocksType.SOCKS5
        if (url.username)
          config.username = decodeURIComponent(url.username)
        if (url.password)
          config.password = decodeURIComponent(url.password)
        break

      case 'mtproxy':
        config.MTProxy = true
        // For MTProxy, the username field contains the secret
        if (url.username) {
          config.secret = decodeURIComponent(url.username)
        }
        break

      default:
        return null
    }

    return config
  }
  catch {
    // Invalid URL format
    return null
  }
}

/**
 * Convert a ProxyConfig to a proxy URL string
 *
 * @param config ProxyConfig object
 * @returns Proxy URL string or null if conversion fails
 */
export function proxyConfigToUrl(config: ProxyConfig): string | null {
  if (!config.ip || !config.port) {
    return null
  }

  let protocol: string
  let auth = ''
  const params = new URLSearchParams()

  if (config.timeout && config.timeout !== 15) { // 15 is the default
    params.set('timeout', config.timeout.toString())
  }

  const queryString = params.toString()
  const query = queryString ? `?${queryString}` : ''

  if (config.MTProxy && config.secret) {
    protocol = 'mtproxy'
    auth = `${encodeURIComponent(config.secret)}@`
  }
  else {
    // SOCKS proxy
    protocol = config.socksType === SocksType.SOCKS4 ? 'socks4' : 'socks5'

    if (config.username || config.password) {
      const username = config.username ? encodeURIComponent(config.username) : ''
      const password = config.password ? encodeURIComponent(config.password) : ''
      auth = `${username}:${password}@`
    }
  }

  return `${protocol}://${auth}${config.ip}:${config.port}${query}`
}
