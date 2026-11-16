<script setup lang="ts">
import { ref } from 'vue'

import AppearancePicker from '../../components/appearance/AppearancePicker.vue'
import PageHeader from '../../components/layout/PageHeader.vue'
import SettingsGroup from '../../components/layout/SettingsGroup.vue'
import MessageComposer from '../../components/MessageComposer.vue'

import { ActionIcon } from '../../components/ui/ActionIcon'
import { Alert } from '../../components/ui/Alert'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Checkbox } from '../../components/ui/Checkbox'
import { Empty } from '../../components/ui/Empty'
import { FormItem } from '../../components/ui/FormItem'
import { Input } from '../../components/ui/Input'
import { ListItem } from '../../components/ui/ListItem'
import { Progress } from '../../components/ui/Progress'
import { Segmented } from '../../components/ui/Segmented'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/Select'
import { Skeleton } from '../../components/ui/Skeleton'
import { Spinner } from '../../components/ui/Spinner'
import { Statistic } from '../../components/ui/Statistic'
import { Switch } from '../../components/ui/Switch'
import { Tag } from '../../components/ui/Tag'

// Reference sheet for the UI primitives. Every screen is built from these, so
// a visual change should be made (and checked) here first.
const SIZES = ['sm', 'md', 'lg'] as const
const BUTTON_VARIANTS = ['primary', 'default', 'fill', 'text', 'danger'] as const

const text = ref('')
const draft = ref('')
const segment = ref('all')
const choice = ref('1536')
const enabled = ref(true)
const checked = ref(true)
const activeRow = ref('inbox')
</script>

<template>
  <div class="h-full flex flex-col overflow-hidden bg-layout">
    <PageHeader title="UI primitives" description="components/ui" />

    <div class="flex-1 overflow-y-auto">
      <div class="grid mx-auto max-w-5xl gap-8 px-4 pb-16 pt-6 lg:grid-cols-2">
        <SettingsGroup title="Button" description="24 / 32 / 40 px, one variant per intent">
          <div v-for="size in SIZES" :key="size" class="flex flex-wrap items-center gap-2">
            <Button v-for="variant in BUTTON_VARIANTS" :key="variant" :variant="variant" :size="size" icon="i-lucide-refresh-cw">
              {{ variant }}
            </Button>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <Button disabled>
              Disabled
            </Button>
            <Button variant="primary" loading>
              Loading
            </Button>
          </div>
        </SettingsGroup>

        <SettingsGroup title="ActionIcon" description="Icon-only actions, with a tooltip">
          <div class="flex flex-wrap items-center gap-2">
            <ActionIcon v-for="size in SIZES" :key="size" icon="i-lucide-search" :size="size" :title="`Search (${size})`" />
            <ActionIcon icon="i-lucide-messages-square" title="Active" active />
            <ActionIcon icon="i-lucide-trash-2" title="Danger" danger />
            <ActionIcon icon="i-lucide-settings-2" title="Disabled" disabled />
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <Tag>Default</Tag>
            <Tag color="primary">
              Primary
            </Tag>
            <Tag color="success" icon="i-lucide-check">
              Synced
            </Tag>
            <Tag color="warning">
              Warning
            </Tag>
            <Tag color="danger">
              Failed
            </Tag>
            <Badge :count="3" />
            <Badge :count="128" />
            <Spinner />
          </div>
        </SettingsGroup>

        <SettingsGroup title="Fields" description="Input, Select and the composer share one box">
          <div class="grid gap-3 sm:grid-cols-3">
            <Input v-for="size in SIZES" :key="size" v-model="text" :size="size" :placeholder="size" />
          </div>
          <div class="grid gap-3 sm:grid-cols-2">
            <Input v-model="text" prefix-icon="i-lucide-search" placeholder="Outlined" />
            <Input v-model="text" variant="filled" prefix-icon="i-lucide-search" placeholder="Filled" />
            <Input v-model="text" placeholder="Disabled" disabled />
            <Select v-model="choice">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="option in ['1536', '1024', '768']" :key="option" :value="option">
                  {{ option }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <MessageComposer v-model="draft" multiline placeholder="Type a message..." />
        </SettingsGroup>

        <SettingsGroup title="Selection" description="Segmented, Switch, Checkbox">
          <div class="flex flex-col items-start gap-3">
            <Segmented
              v-for="size in SIZES"
              :key="size"
              v-model="segment"
              :size="size"
              :options="[
                { value: 'all', label: 'All', icon: 'i-lucide-layers' },
                { value: 'messages', label: 'Messages' },
                { value: 'photos', label: 'Photos' },
              ]"
            />
          </div>
          <FormItem label="Sync media" description="Download photos and files while syncing" layout="horizontal">
            <Switch v-model:checked="enabled" />
          </FormItem>
          <FormItem label="Select this chat" layout="horizontal">
            <Checkbox v-model="checked" />
          </FormItem>
          <AppearancePicker />
        </SettingsGroup>

        <SettingsGroup title="List" description="Rows in navigation, menus and pickers">
          <div class="flex flex-col gap-0.5">
            <ListItem
              v-for="row in [
                { key: 'inbox', label: 'Inbox', icon: 'i-lucide-inbox' },
                { key: 'work', label: 'Work', icon: 'i-lucide-briefcase' },
                { key: 'news', label: 'News', icon: 'i-lucide-newspaper' },
              ]"
              :key="row.key"
              :icon="row.icon"
              :active="activeRow === row.key"
              @click="activeRow = row.key"
            >
              {{ row.label }}
            </ListItem>
            <ListItem icon="i-lucide-sparkles" description="Ask about the selected chats">
              <span class="text-fg">Open AI Chat</span>
            </ListItem>
          </div>
        </SettingsGroup>

        <SettingsGroup title="Feedback" description="Alert, Empty, Progress, Statistic, Skeleton">
          <Alert>Could not reach the server.</Alert>
          <Alert type="info">
            Sync keeps running in the background.
          </Alert>
          <Progress :model-value="64" />
          <div class="grid grid-cols-3 gap-2">
            <Statistic label="Total" :value="12840" />
            <Statistic label="Synced" :value="8217" />
            <Statistic label="Unsynced" :value="4623" tone="muted" />
          </div>
          <Skeleton class="h-8" />
          <Empty icon="i-lucide-search-x" title="No chats found" description="Try another keyword" class="h-auto" />
        </SettingsGroup>
      </div>
    </div>
  </div>
</template>
