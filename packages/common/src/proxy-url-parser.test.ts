/* eslint-disable sonarjs/no-hardcoded-passwords */

import { describe, expect, it } from 'vitest'

import { SocksType } from './config-schema'
import { parseProxyUrl, proxyConfigToUrl } from './proxy-url-parser'

describe('proxyUrl Parser', () => {
  describe('parseProxyUrl', () => {
    it('should parse SOCKS5 proxy URL with auth', () => {
      const result = parseProxyUrl('socks5://user:pass@proxy.example.com:1080')
      expect(result).toEqual({
        ip: 'proxy.example.com',
        port: 1080,
        socksType: SocksType.SOCKS5,
        username: 'user',
        password: 'pass',
      })
    })

    it('should parse SOCKS4 proxy URL with timeout', () => {
      const result = parseProxyUrl('socks4://user:pass@proxy.example.com:1080?timeout=30')
      expect(result).toEqual({
        ip: 'proxy.example.com',
        port: 1080,
        socksType: SocksType.SOCKS4,
        username: 'user',
        password: 'pass',
        timeout: 30,
      })
    })

    it('should parse HTTP proxy URL', () => {
      const result = parseProxyUrl('http://user:pass@proxy.example.com:8080')
      expect(result).toEqual({
        ip: 'proxy.example.com',
        port: 8080,
        socksType: SocksType.SOCKS5, // HTTP defaults to SOCKS5
        username: 'user',
        password: 'pass',
      })
    })

    it('should parse MTProxy URL', () => {
      const result = parseProxyUrl('mtproxy://secret123@mtproxy.example.com:443?timeout=20')
      expect(result).toEqual({
        ip: 'mtproxy.example.com',
        port: 443,
        MTProxy: true,
        secret: 'secret123',
        timeout: 20,
      })
    })

    it('should parse proxy URL without auth', () => {
      const result = parseProxyUrl('socks5://proxy.example.com:1080')
      expect(result).toEqual({
        ip: 'proxy.example.com',
        port: 1080,
        socksType: SocksType.SOCKS5,
      })
    })

    it('should return null for invalid URL', () => {
      const result = parseProxyUrl('invalid://not-a-valid-proxy')
      expect(result).toBeNull()
    })

    it('should return null for missing host', () => {
      const result = parseProxyUrl('socks5://:1080')
      expect(result).toBeNull()
    })

    it('should return null for missing port', () => {
      const result = parseProxyUrl('socks5://proxy.example.com')
      expect(result).toBeNull()
    })
  })

  describe('proxyConfigToUrl', () => {
    it('should convert SOCKS5 config to URL', () => {
      const config = {
        ip: 'proxy.example.com',
        port: 1080,
        socksType: SocksType.SOCKS5,
        username: 'user',
        password: 'pass',
      }
      const result = proxyConfigToUrl(config)
      expect(result).toBe('socks5://user:pass@proxy.example.com:1080')
    })

    it('should convert MTProxy config to URL', () => {
      const config = {
        ip: 'mtproxy.example.com',
        port: 443,
        MTProxy: true,
        secret: 'secret123',
        timeout: 20,
      }
      const result = proxyConfigToUrl(config)
      expect(result).toBe('mtproxy://secret123@mtproxy.example.com:443?timeout=20')
    })

    it('should convert config without auth to URL', () => {
      const config = {
        ip: 'proxy.example.com',
        port: 1080,
        socksType: SocksType.SOCKS5,
      }
      const result = proxyConfigToUrl(config)
      expect(result).toBe('socks5://proxy.example.com:1080')
    })

    it('should return null for invalid config', () => {
      const config = {
        ip: '',
        port: 0,
      }
      const result = proxyConfigToUrl(config)
      expect(result).toBeNull()
    })
  })

  describe('round-trip conversion', () => {
    it('should maintain consistency through parse and convert', () => {
      const testUrls = [
        'socks5://user:pass@proxy.example.com:1080',
        'socks4://user:pass@proxy.example.com:1080?timeout=30',
        'mtproxy://secret123@mtproxy.example.com:443',
        'socks5://proxy.example.com:1080',
      ]

      testUrls.forEach((originalUrl) => {
        const parsed = parseProxyUrl(originalUrl)
        expect(parsed).toBeDefined()

        const convertedUrl = proxyConfigToUrl(parsed!)
        expect(convertedUrl).toBeDefined()

        // Parse the converted URL again to ensure consistency
        const reparsed = parseProxyUrl(convertedUrl!)
        expect(reparsed).toEqual(parsed)
      })
    })
  })
})
