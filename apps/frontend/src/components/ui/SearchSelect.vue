<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = withDefaults(defineProps<Props<any>>(), {
  placeholder: 'Searching...',
  disabled: false,
  label: '',
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: any): void
}>()

interface Option<T> {
  id: T
  label: string
  [key: string]: any
}

interface Props<T> {
  modelValue: T | undefined
  options: Option<T>[]
  placeholder?: string
  disabled?: boolean
  label?: string
}

const searchQuery = ref('')
const isDropdownOpen = ref(false)

const filteredOptions = computed(() => {
  if (!searchQuery.value.trim())
    return props.options

  const query = searchQuery.value.toLowerCase()
  return props.options.filter(option =>
    option.label.toLowerCase().includes(query),
  )
})

const selectedOption = computed(() => {
  if (props.modelValue === undefined)
    return null
  return props.options.find(option => option.id === props.modelValue) || null
})

function selectOption(option: Option<any>): void {
  emit('update:modelValue', option.id)
  isDropdownOpen.value = false
}

function clearSelection(): void {
  emit('update:modelValue', undefined)
}

// Reset search when dropdown closes
watch(isDropdownOpen, (isOpen) => {
  if (!isOpen) {
    setTimeout(() => {
      searchQuery.value = ''
    }, 100)
  }
})

// Close dropdown when clicking outside
function addOutsideClickListener(): void {
  document.addEventListener('click', handleOutsideClick)
}

function removeOutsideClickListener(): void {
  document.removeEventListener('click', handleOutsideClick)
}

function handleOutsideClick(event: MouseEvent): void {
  const target = event.target as HTMLElement
  if (!target.closest('.search-select-container')) {
    isDropdownOpen.value = false
  }
}

// Add listeners when dropdown opens
watch(isDropdownOpen, (isOpen) => {
  if (isOpen) {
    addOutsideClickListener()
  }
  else {
    removeOutsideClickListener()
  }
})
</script>

<template>
  <div class="search-select-container">
    <label v-if="label" class="mb-2 block text-sm text-gray-700 font-medium dark:text-gray-300">
      {{ label }}
    </label>
    <div class="relative">
      <div class="flex items-center border border-gray-300 rounded-md bg-white dark:border-gray-600 focus-within:border-blue-500 dark:bg-gray-700 focus-within:ring-2 focus-within:ring-blue-200 dark:focus-within:border-blue-500 dark:focus-within:ring-blue-700/30">
        <span class="pl-3 text-gray-500 dark:text-gray-400">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </span>
        <input
          v-model="searchQuery"
          type="text"
          :placeholder="placeholder"
          class="w-full bg-transparent px-3 py-2.5 text-gray-700 outline-none dark:text-gray-100"
          :disabled="disabled"
          @focus="isDropdownOpen = true"
          @click="isDropdownOpen = true"
        >
        <span v-if="searchQuery" class="cursor-pointer pr-3 text-gray-500 dark:text-gray-400" @click="searchQuery = ''">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </span>
        <span class="cursor-pointer pr-3 text-gray-500 dark:text-gray-400" @click="isDropdownOpen = !isDropdownOpen">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 transition-transform" :class="{ 'rotate-180': isDropdownOpen }" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </div>

      <!-- Options dropdown -->
      <div
        v-if="isDropdownOpen && filteredOptions.length > 0"
        class="absolute z-10 mt-1 w-full overflow-hidden border border-gray-200 rounded-md bg-white shadow-lg dark:border-gray-600 dark:bg-gray-700"
      >
        <div class="max-h-60 overflow-y-auto">
          <div
            v-for="option in filteredOptions"
            :key="option.id"
            class="flex cursor-pointer items-center px-4 py-2.5 hover:bg-gray-100 dark:hover:bg-gray-600"
            :class="{ 'bg-blue-50 dark:bg-blue-900/20': modelValue === option.id }"
            @click="selectOption(option)"
          >
            <span class="text-sm">{{ option.label }}</span>
          </div>
        </div>
        <div v-if="filteredOptions.length === 0" class="px-4 py-2.5 text-sm text-gray-500 dark:text-gray-400">
          No match
        </div>
      </div>

      <!-- Selected option display -->
      <div v-if="selectedOption" class="mt-2 flex items-center justify-between rounded-md bg-blue-50 px-3 py-2 text-sm dark:bg-blue-900/20">
        <span>{{ selectedOption.label }}</span>
        <button
          class="text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400"
          :disabled="disabled"
          type="button"
          @click="clearSelection"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>
