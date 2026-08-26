// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, nextTick, ref } from 'vue'

import SearchDialog from '../SearchDialog.vue'

const { routerPush } = vi.hoisted(() => ({
  routerPush: vi.fn(),
}))

vi.mock('@tg-search/client', () => ({
  formatMessageTimestamp: () => 'now',
  useChatStore: () => ({ getChat: () => undefined }),
}))

vi.mock('@vueuse/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@vueuse/core')>()

  return {
    ...actual,
    onKeyStroke: () => {},
    useClipboard: () => ({ copy: vi.fn() }),
    useDebounce: <T>(value: T) => value,
    useMediaQuery: () => ref(false),
  }
})

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: routerPush }),
}))

vi.mock('../avatar/EntityAvatar.vue', () => ({
  default: defineComponent({
    name: 'EntityAvatarStub',
    template: '<span />',
  }),
}))

vi.mock('../PhotoSearchResults.vue', () => ({
  default: defineComponent({
    name: 'PhotoSearchResultsStub',
    template: '<span />',
  }),
}))

vi.mock('../../composables/use-search-dialog-state', () => ({
  useSearchDialogState: () => ({
    activeMode: ref('messages'),
    chatTypeFilter: ref('all'),
    keyword: ref('query'),
    searchScope: ref('all'),
  }),
}))

vi.mock('../../composables/use-search-dialog-results', async () => {
  const { computed, ref } = await import('vue')
  const searchResult = ref(Array.from({ length: 40 }, (_, index) => ({
    uuid: `message-${index}`,
    platform: 'telegram' as const,
    platformMessageId: String(index),
    chatId: '100',
    fromId: 'sender',
    fromName: 'Sender',
    content: `Result ${index}`,
    reply: { isReply: false },
    forward: { isForward: false },
    createdAt: 1,
    updatedAt: 1,
    deletedAt: undefined,
    platformTimestamp: 1,
  })))

  return {
    useSearchDialogResults: () => ({
      hasResults: computed(() => true),
      isLoading: ref(false),
      isLoadingMoreMessages: ref(false),
      isLoadingMorePhotos: ref(false),
      loadMoreMessages: vi.fn(),
      loadMorePhotos: vi.fn(),
      messagesHasMore: ref(false),
      photoResult: ref([]),
      photosHasMore: ref(false),
      searchResult,
      shouldRunSearch: computed(() => true),
      showMessagesPanel: computed(() => true),
      showPhotosPanel: computed(() => false),
    }),
  }
})

describe('searchDialog scroll retention', () => {
  const mountedApps: Array<{ app: ReturnType<typeof createApp>, host: HTMLElement }> = []

  afterEach(() => {
    for (const { app, host } of mountedApps) {
      app.unmount()
      host.remove()
    }
    mountedApps.length = 0
    routerPush.mockReset()
  })

  it('keeps the mounted result list scroll position after navigation and reopen', async () => {
    const isOpen = ref(true)
    const routePath = ref('/chat/100')
    routerPush.mockImplementation(async () => {
      routePath.value = '/chat/200'
    })

    const app = createApp(defineComponent({
      setup() {
        return () => h('main', [
          h('output', { 'data-testid': 'route' }, routePath.value),
          h(SearchDialog, {
            'open': isOpen.value,
            'onUpdate:open': (open: boolean) => {
              isOpen.value = open
            },
          }),
        ])
      },
    }))
    const host = document.createElement('div')
    document.body.append(host)
    mountedApps.push({ app, host })
    app.mount(host)
    await nextTick()

    const resultList = document.body.querySelector('ul') as HTMLUListElement
    expect(resultList).toBeTruthy()
    resultList.scrollTop = 360

    // The old page-owned dialog was destroyed on navigation, which reset this list's scrollTop.
    ;(resultList.querySelector('li') as HTMLElement).click()
    await nextTick()

    expect(routerPush).toHaveBeenCalledTimes(1)
    expect(host.querySelector('[data-testid="route"]')?.textContent).toBe('/chat/200')
    expect(isOpen.value).toBe(false)

    isOpen.value = true
    await nextTick()

    const reopenedResultList = document.body.querySelector('ul') as HTMLUListElement
    expect(reopenedResultList).toBe(resultList)
    expect(reopenedResultList.scrollTop).toBe(360)
  })
})
