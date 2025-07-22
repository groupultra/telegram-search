import type { Ref } from 'vue'

import { computed, nextTick, reactive, ref } from 'vue'

export interface VirtualListItem {
  id: string | number
  height?: number
  data: any
}

export interface VirtualListOptions {
  itemHeight: number // Default item height estimate
  containerHeight: number
  overscan?: number // Number of items to render outside viewport
  getItemHeight?: (item: VirtualListItem, index: number) => number
}

export interface VirtualListState {
  scrollTop: number
  isScrolling: boolean
  measuredHeights: Map<string | number, number>
}

export function useVirtualList(
  items: Ref<VirtualListItem[]>,
  options: VirtualListOptions,
) {
  const {
    itemHeight: defaultItemHeight,
    overscan = 3,
    getItemHeight,
  } = options

  // Make containerHeight reactive
  const containerHeight = ref(options.containerHeight)

  const containerRef = ref<HTMLElement>()
  const state = reactive<VirtualListState>({
    scrollTop: 0,
    isScrolling: false,
    measuredHeights: new Map(),
  })

  let scrollTimer: ReturnType<typeof setTimeout> | null = null

  // Calculate item positions and heights
  const itemPositions = computed(() => {
    const positions: Array<{ top: number, height: number, bottom: number }> = []
    let currentTop = 0

    for (let i = 0; i < items.value.length; i++) {
      const item = items.value[i]
      let height = defaultItemHeight

      // Use custom height calculation if provided
      if (getItemHeight) {
        height = getItemHeight(item, i)
      }
      // Use measured height if available
      else if (state.measuredHeights.has(item.id)) {
        height = state.measuredHeights.get(item.id)!
      }
      // Use item's predefined height
      else if (item.height) {
        height = item.height
      }

      positions.push({
        top: currentTop,
        height,
        bottom: currentTop + height,
      })

      currentTop += height
    }

    return positions
  })

  // Calculate total height
  const totalHeight = computed(() => {
    const lastPosition = itemPositions.value[itemPositions.value.length - 1]
    return lastPosition ? lastPosition.bottom : 0
  })

  // Calculate visible range
  const visibleRange = computed(() => {
    const viewportTop = state.scrollTop
    const viewportBottom = state.scrollTop + containerHeight.value

    let startIndex = 0
    let endIndex = items.value.length - 1

    // Binary search for start index
    let left = 0
    let right = items.value.length - 1
    while (left <= right) {
      const mid = Math.floor((left + right) / 2)
      const position = itemPositions.value[mid]

      if (position.bottom <= viewportTop) {
        left = mid + 1
      }
      else {
        right = mid - 1
        startIndex = mid
      }
    }

    // Binary search for end index
    left = startIndex
    right = items.value.length - 1
    while (left <= right) {
      const mid = Math.floor((left + right) / 2)
      const position = itemPositions.value[mid]

      if (position.top >= viewportBottom) {
        right = mid - 1
      }
      else {
        left = mid + 1
        endIndex = mid
      }
    }

    // Apply overscan
    const overscanStart = Math.max(0, startIndex - overscan)
    const overscanEnd = Math.min(items.value.length - 1, endIndex + overscan)

    return {
      start: overscanStart,
      end: overscanEnd,
      visibleStart: startIndex,
      visibleEnd: endIndex,
    }
  })

  // Get visible items with positioning
  const visibleItems = computed(() => {
    const range = visibleRange.value
    const result = []

    for (let i = range.start; i <= range.end; i++) {
      const item = items.value[i]
      const position = itemPositions.value[i]

      if (item && position) {
        result.push({
          item,
          index: i,
          style: {
            position: 'absolute' as const,
            top: `${position.top}px`,
            height: `${position.height}px`,
            width: '100%',
          },
        })
      }
    }

    return result
  })

  // Handle scroll events
  function handleScroll(event: Event) {
    const target = event.target as HTMLElement
    state.scrollTop = target.scrollTop
    state.isScrolling = true

    // Clear existing timer
    if (scrollTimer) {
      clearTimeout(scrollTimer)
    }

    // Set scrolling to false after scroll stops
    scrollTimer = setTimeout(() => {
      state.isScrolling = false
    }, 150)
  }

  // Measure item height after render
  function measureItem(id: string | number, height: number) {
    if (height > 0 && height !== state.measuredHeights.get(id)) {
      state.measuredHeights.set(id, height)
    }
  }

  // Scroll to specific item
  async function scrollToItem(index: number, align: 'start' | 'center' | 'end' = 'start') {
    if (!containerRef.value || index < 0 || index >= items.value.length) {
      return
    }

    await nextTick()

    const position = itemPositions.value[index]
    if (!position)
      return

    let scrollTop = position.top

    if (align === 'center') {
      scrollTop = position.top - (containerHeight.value - position.height) / 2
    }
    else if (align === 'end') {
      scrollTop = position.bottom - containerHeight.value
    }

    // Clamp scroll position
    scrollTop = Math.max(0, Math.min(scrollTop, totalHeight.value - containerHeight.value))

    containerRef.value.scrollTop = scrollTop
    state.scrollTop = scrollTop
  }

  // Scroll to bottom
  async function scrollToBottom() {
    if (!containerRef.value)
      return

    await nextTick()
    const maxScrollTop = totalHeight.value - containerHeight.value
    containerRef.value.scrollTop = Math.max(0, maxScrollTop)
    state.scrollTop = Math.max(0, maxScrollTop)
  }

  // Get scroll offset for maintaining position
  function getScrollOffset(anchorId: string | number): { anchorIndex: number, offset: number } | null {
    const anchorIndex = items.value.findIndex(item => item.id === anchorId)
    if (anchorIndex === -1)
      return null

    const position = itemPositions.value[anchorIndex]
    if (!position)
      return null

    return {
      anchorIndex,
      offset: state.scrollTop - position.top,
    }
  }

  // Restore scroll position using anchor
  async function restoreScrollPosition(anchor: { anchorIndex: number, offset: number }) {
    await nextTick()

    const position = itemPositions.value[anchor.anchorIndex]
    if (!position || !containerRef.value)
      return

    const newScrollTop = position.top + anchor.offset
    containerRef.value.scrollTop = newScrollTop
    state.scrollTop = newScrollTop
  }

  // Function to update container height dynamically
  function updateContainerHeight(newHeight: number) {
    containerHeight.value = newHeight
  }

  return {
    containerRef,
    state,
    totalHeight,
    visibleItems,
    visibleRange,
    handleScroll,
    measureItem,
    scrollToItem,
    scrollToBottom,
    getScrollOffset,
    restoreScrollPosition,
    updateContainerHeight,
  }
}
