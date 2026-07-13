import { describe, expect, it, vi } from 'vitest'

import { closeOwnedTelegramClient, createAuthPrompts } from './auth-support'

describe('cLI authentication support', () => {
  it('destroys an owned GramJS client so its update loop exits', async () => {
    const destroy = vi.fn(async () => {})
    await closeOwnedTelegramClient({ destroy })

    expect(destroy).toHaveBeenCalledOnce()
  })

  it('uses secret input for Telegram codes and 2FA passwords', async () => {
    const question = vi.fn(async () => 'phone')
    const secret = vi.fn(async ({ message }: { message: string, mask: boolean }) => message)
    const prompts = createAuthPrompts({ question, secret })

    expect(await prompts.phoneNumber()).toBe('phone')
    expect(await prompts.phoneCode()).toBe('Telegram code')
    expect(await prompts.password()).toBe('2FA password')
    expect(secret).toHaveBeenCalledTimes(2)
    expect(secret).toHaveBeenNthCalledWith(1, { message: 'Telegram code', mask: true })
    expect(secret).toHaveBeenNthCalledWith(2, { message: '2FA password', mask: true })
  })
})
