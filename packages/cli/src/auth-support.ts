import type { TelegramClient } from 'telegram'

import passwordPrompt from '@inquirer/password'

interface SecretPromptOptions {
  message: string
  mask: boolean
}

interface AuthPromptOptions {
  phone?: string
  question: (message: string) => Promise<string>
  secret?: (options: SecretPromptOptions) => Promise<string>
}

export async function closeOwnedTelegramClient(client: Pick<TelegramClient, 'destroy'>): Promise<void> {
  await client.destroy()
}

export function createAuthPrompts(options: AuthPromptOptions) {
  const secret = options.secret ?? passwordPrompt
  return {
    phoneNumber: async () => options.phone || await options.question('Phone number: '),
    phoneCode: async () => secret({ message: 'Telegram code', mask: true }),
    password: async () => secret({ message: '2FA password', mask: true }),
  }
}
