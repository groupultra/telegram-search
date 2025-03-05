<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Pagination from './Pagination.vue'
import SelectDropdown from './SelectDropdown.vue'

interface Option<T> {
  id: T
  title: string
  subtitle?: string
  type?: string
}

interface Props<T> {
  modelValue: T[]
  options: Option<T>[]
  itemsPerPage?: number
  typeOptions?: { label: string, value: string }[]
  searchPlaceholder?: string
  noResultsText?: string
  selectedCountText?: string
}

const props = withDefaults(defineProps<Props<any>>(), {
  itemsPerPage: 12,
  searchPlaceholder: '',
  noResultsText: 'No results found',
  selectedCountText: 'Selected: {count}',
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: any[]): void
}>()

const { t } = useI18n()

const selectedType = ref<string>('')
const searchQuery = ref('')
const currentPage = ref(1)

// Filtered options based on type and search query
const filteredOptions = computed(() => {
  let filtered = props.options

  // Filter by type if type options are provided
  if (props.typeOptions && selectedType.value) {
    filtered = filtered.filter(option => option.type === selectedType.value)
  }

  // Filter by search query
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(option =>
      option.title.toLowerCase().includes(query)
      || option.subtitle?.toLowerCase().includes(query)
      || option.id.toString().includes(query),
    )
  }

  // Sort by selection status
  return filtered.sort((a, b) => {
    const aSelected = props.modelValue.includes(a.id)
    const bSelected = props.modelValue.includes(b.id)
    if (aSelected && !bSelected)
      return -1
    if (!aSelected && bSelected)
      return 1
    return 0
  })
})

// Paginated options
const paginatedOptions = computed(() => {
  const startIndex = (currentPage.value - 1) * props.itemsPerPage
  const endIndex = startIndex + props.itemsPerPage
  return filteredOptions.value.slice(startIndex, endIndex)
})

// Total pages
const totalPages = computed(() =>
  Math.ceil(filteredOptions.value.length / props.itemsPerPage),
)

// Selected count
const selectedCount = computed(() => props.modelValue.length)

function isSelected(id: any): boolean {
  return props.modelValue.includes(id)
}

function toggleSelection(id: any): void {
  const newValue = [...props.modelValue]
  const index = newValue.indexOf(id)

  if (index === -1)
    newValue.push(id)
  else
    newValue.splice(index, 1)

  emit('update:modelValue', newValue)
}

function changePage(page: number): void {
  currentPage.value = page
}

// Reset page when filters change
watch([selectedType, searchQuery], () => {
  currentPage.value = 1
})
</script>

<template>
  <div class="space-y-4">
    <!-- Filters -->
    <div class="flex flex-col items-start gap-4 md:flex-row md:items-end">
      <!-- Type Selection -->
      <div v-if="typeOptions" class="w-full md:w-48">
        <SelectDropdown
          v-model="selectedType"
          :options="typeOptions"
          :label="t('component.grid_selector.type')"
        />
      </div>

      <!-- Search Input -->
      <div class="flex-1">
        <input
          v-model="searchQuery"
          type="text"
          class="w-full border border-gray-300 rounded-md px-4 py-2 dark:border-gray-600 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
          :placeholder="searchPlaceholder"
        >
      </div>
    </div>

    <!-- Grid List -->
    <TransitionGroup
      name="grid-list"
      tag="div"
      class="grid gap-4 lg:grid-cols-3 md:grid-cols-2"
    >
      <button
        v-for="option in paginatedOptions"
        :key="option.id"
        class="grid-item relative w-full flex cursor-pointer items-center border rounded-lg p-4 text-left space-x-3 hover:shadow-md"
        :class="{
          'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-md selected': isSelected(option.id),
          'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600': !isSelected(option.id),
        }"
        @click="toggleSelection(option.id)"
      >
        <div class="min-w-0 flex-1">
          <div class="focus:outline-none">
            <p class="flex items-center gap-2 text-sm text-gray-900 font-medium dark:text-gray-100">
              {{ option.title }}
              <TransitionGroup name="fade">
                <span v-if="isSelected(option.id)" :key="`check${option.id}`" class="text-blue-500 dark:text-blue-400">
                  <div class="i-carbon-checkmark h-4 w-4" />
                </span>
              </TransitionGroup>
            </p>
            <p v-if="option.subtitle" class="truncate text-sm text-gray-500 dark:text-gray-400">
              {{ option.subtitle }}
            </p>
          </div>
        </div>
      </button>
    </TransitionGroup>

    <!-- Pagination -->
    <Pagination
      v-if="totalPages > 1"
      v-model="currentPage"
      :total="totalPages"
      :visible-buttons="9"
    />

    <!-- No Results Message -->
    <div v-if="filteredOptions.length === 0" class="py-8 text-center text-gray-500 dark:text-gray-400">
      {{ noResultsText }}
    </div>
  </div>
</template>

<style scoped>
.grid-item {
  transition: all 0.3s ease-in-out;
}

.grid-item.selected {
  transform: scale(1.02);
}

/* Grid list animations */
.grid-list-move,
.grid-list-enter-active,
.grid-list-leave-active {
  transition: all 0.3s ease;
}

.grid-list-enter-from,
.grid-list-leave-to {
  opacity: 0;
  transform: translateY(30px);
}

.grid-list-leave-active {
  position: absolute;
}

/* Checkmark animations */
.fade-enter-active,
.fade-leave-active {
  transition: all 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: scale(0.8);
}

/* Hover effects */
.grid-item:hover:not(.selected) {
  transform: translateY(-2px);
}

.grid-item:active {
  transform: scale(0.98);
}
</style>
