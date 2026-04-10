import { describe, expect, it } from 'vitest'

import { matchesSearchChatTypeFilter } from '../search-dialog'

describe('matchesSearchChatTypeFilter', () => {
  it('returns true for any dialog type when all is selected', () => {
    expect(matchesSearchChatTypeFilter('all', 'bot')).toBe(true)
    expect(matchesSearchChatTypeFilter('all', 'group')).toBe(true)
  })

  it('returns true only when the dialog type matches the selected filter', () => {
    expect(matchesSearchChatTypeFilter('bot', 'bot')).toBe(true)
    expect(matchesSearchChatTypeFilter('bot', 'user')).toBe(false)
    expect(matchesSearchChatTypeFilter('channel', 'supergroup')).toBe(false)
  })

  it('keeps unresolved dialog types instead of dropping them', () => {
    expect(matchesSearchChatTypeFilter('bot', undefined)).toBe(true)
  })
})
