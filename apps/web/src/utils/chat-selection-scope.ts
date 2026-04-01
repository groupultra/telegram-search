export function areAllVisibleChatsSelected(selectedIds: number[], visibleIds: number[]): boolean {
  if (visibleIds.length === 0) {
    return false
  }

  const selectedSet = new Set(selectedIds)
  return visibleIds.every(id => selectedSet.has(id))
}

export function toggleVisibleChatSelection(selectedIds: number[], visibleIds: number[]): number[] {
  if (visibleIds.length === 0) {
    return selectedIds
  }

  if (areAllVisibleChatsSelected(selectedIds, visibleIds)) {
    const visibleSet = new Set(visibleIds)
    return selectedIds.filter(id => !visibleSet.has(id))
  }

  return [...new Set([...selectedIds, ...visibleIds])]
}
