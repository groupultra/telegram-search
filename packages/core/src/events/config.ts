import type { AccountSettings } from '../types/account-settings'

import { defineInvokeEventa } from '@moeru/eventa'

/** Fetch current account settings (RPC) */
export const configFetchInvoke = defineInvokeEventa<
  { accountSettings: AccountSettings },
  void
>('config:fetch')

/** Update account settings (RPC) — returns the updated settings */
export const configUpdateInvoke = defineInvokeEventa<
  { accountSettings: AccountSettings },
  { accountSettings: AccountSettings }
>('config:update')
