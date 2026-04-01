import { describe, expect, it } from 'vitest'

import {
  areAllVisibleChatsSelected,
  toggleVisibleChatSelection,
} from '../chat-selection-scope'

describe('chat selection scope helpers', () => {
  it('treats only the current visible scope as fully selected', () => {
    expect(areAllVisibleChatsSelected([1, 2, 3, 9], [1, 2, 3])).toBe(true)
    expect(areAllVisibleChatsSelected([1, 2, 9], [1, 2, 3])).toBe(false)
  })

  it('adds only the visible chats when selecting all in the current scope', () => {
    expect(toggleVisibleChatSelection([9], [1, 2, 3])).toEqual([9, 1, 2, 3])
  })

  it('preserves hidden selections when computing the next total selected count', () => {
    const nextSelectedChats = toggleVisibleChatSelection([7, 8], [1, 2, 3])

    expect(nextSelectedChats).toHaveLength(5)
  })

  it('removes only the visible chats when deselecting the current scope', () => {
    // Hidden selections should stay selected when toggling a filtered subset off.
    expect(toggleVisibleChatSelection([1, 2, 3, 9], [1, 2, 3])).toEqual([9])
  })
})
