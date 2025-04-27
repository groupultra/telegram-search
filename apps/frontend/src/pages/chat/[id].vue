<script setup lang="ts">
import type { Action } from '../../types/action'
import { onMounted } from 'vue'
import { useRoute } from 'vue-router'

const props = defineProps<{
  changeTitle?: (title: string) => void
  setActions?: (actions: Action[]) => void
}>()
const route = useRoute()
const id = route.params.id

onMounted(() => {
  props.changeTitle?.(`👀 ${id}`)
  props.setActions?.([{
    icon: 'i-lucide-search',
    onClick: () => {
      console.log('search')
    },
  }])
})
</script>

<template>
  <div class="h-full flex flex-col p-2">
    <div class="overflow-auto space-y-6">
      <MessageItem sender="用户名" timestamp="12:30" is-sender>
        <TextMessage text="你好！这是一条消息示例。" />
      </MessageItem>
      <MessageItem sender="RainbowBird" timestamp="12:30">
        <TextMessage text="你好！这是一条消息示例。" />
      </MessageItem>
      <MessageItem sender="用户名" timestamp="12:30" is-sender>
        <ImageMessage image="https://api.dicebear.com/6.x/bottts/svg?seed=RainbowBird1" />
      </MessageItem>
      <MessageItem sender="用户名" timestamp="12:30" is-sender>
        <RefMessage text="你好！这是一条消息示例。">
          <TextMessage text="被引用消息 你好！这是一条消息示例。" />
        </RefMessage>
      </MessageItem>
      <MessageItem sender="用户名" timestamp="12:30" is-sender>
        <RefMessage text="你好！这是一条消息示例。">
          <ImageMessage image="https://api.dicebear.com/6.x/bottts/svg?seed=RainbowBird1" />
        </RefMessage>
      </MessageItem>
      <MessageItem sender="用户名" timestamp="12:30" is-sender>
        <ComposeMessage direction="row">
          <template #first>
            <TextMessage text="组合消息" />
          </template>
          <template #second>
            <ImageMessage image="https://api.dicebear.com/6.x/bottts/svg?seed=RainbowBird1" />
          </template>
        </ComposeMessage>
      </MessageItem>
      <MessageItem sender="用户名" timestamp="12:30" is-sender>
        <ComposeMessage direction="column">
          <template #first>
            <TextMessage text="组合消息" />
          </template>
          <template #second>
            <ImageMessage image="https://api.dicebear.com/6.x/bottts/svg?seed=RainbowBird21" />
          </template>
        </ComposeMessage>
      </MessageItem>
      <MessageItem sender="用户名" timestamp="12:30" is-sender>
        <ComposeMessage direction="row">
          <template #first>
            <ComposeMessage direction="column">
              <template #first>
                <ComposeMessage direction="row">
                  <template #first>
                    <ComposeMessage direction="column">
                      <template #first>
                        <TextMessage text="组合消息" />
                      </template>
                      <template #second>
                        <ComposeMessage direction="row">
                          <template #first>
                            <ComposeMessage direction="column">
                              <template #first>
                                <TextMessage text="组合消息" />
                              </template>
                              <template #second>
                                <ImageMessage image="https://api.dicebear.com/6.x/bottts/svg?seed=Rain1bowBird1" />
                              </template>
                            </ComposeMessage>
                          </template>
                          <template #second>
                            <ComposeMessage direction="row">
                              <template #first>
                                <ComposeMessage direction="column">
                                  <template #first>
                                    <TextMessage text="组合消息" />
                                  </template>
                                  <template #second>
                                    <ImageMessage image="https://api.dicebear.com/6.x/bottts/svg?seed=Rain1bowBird1" />
                                  </template>
                                </ComposeMessage>
                              </template>
                              <template #second>
                                <ImageMessage image="https://api.dicebear.com/6.x/bottts/svg?seed=Rai2nbowBird1" />
                              </template>
                            </ComposeMessage>
                          </template>
                        </ComposeMessage>
                      </template>
                    </ComposeMessage>
                  </template>
                  <template #second>
                    <ImageMessage image="https://api.dicebear.com/6.x/bottts/svg?seed=Rai2nbowBird1" />
                  </template>
                </ComposeMessage>
              </template>
              <template #second>
                <ImageMessage image="https://api.dicebear.com/6.x/bottts/svg?seed=Rain1bowBird1" />
              </template>
            </ComposeMessage>
          </template>
          <template #second>
            <ComposeMessage direction="row">
              <template #first>
                <ComposeMessage direction="column">
                  <template #first>
                    <TextMessage text="组合消息" />
                  </template>
                  <template #second>
                    <ImageMessage image="https://api.dicebear.com/6.x/bottts/svg?seed=Rain1bowBird1" />
                  </template>
                </ComposeMessage>
              </template>
              <template #second>
                <ComposeMessage direction="row">
                  <template #first>
                    <ComposeMessage direction="column">
                      <template #first>
                        <TextMessage text="组合消息" />
                      </template>
                      <template #second>
                        <ImageMessage image="https://api.dicebear.com/6.x/bottts/svg?seed=Rain1bowBird1" />
                      </template>
                    </ComposeMessage>
                  </template>
                  <template #second>
                    <ImageMessage image="https://api.dicebear.com/6.x/bottts/svg?seed=Rai2nbowBird1" />
                  </template>
                </ComposeMessage>
              </template>
            </ComposeMessage>
          </template>
        </ComposeMessage>
      </MessageItem>
    </div>
  </div>
</template>
