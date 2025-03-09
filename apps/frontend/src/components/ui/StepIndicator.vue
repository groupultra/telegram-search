<!-- Step Indicator component -->
<script setup lang="ts">
/**
 * Step interface
 */
interface Step {
  /**
   * Step identifier
   */
  id: string
  /**
   * Step label
   */
  label: string
  /**
   * Step icon class
   */
  icon: string
}

const props = defineProps<{
  /**
   * Array of steps to display
   */
  steps: Step[]
  /**
   * ID of the current active step
   */
  currentStep: string
  /**
   * Connect steps with lines
   */
  connected?: boolean
}>()

/**
 * Determines the status of each step
 */
function getStepStatus(step: Step): 'active' | 'completed' | 'pending' {
  const stepIndex = props.steps.findIndex(s => s.id === step.id)
  const currentIndex = props.steps.findIndex(s => s.id === props.currentStep)

  if (stepIndex === currentIndex)
    return 'active'
  if (stepIndex < currentIndex)
    return 'completed'
  return 'pending'
}

/**
 * Gets class for step indicator
 */
function getStepClass(status: 'active' | 'completed' | 'pending'): string {
  const baseClasses = 'h-8 w-8 flex items-center justify-center rounded-full'

  if (status === 'active')
    return `${baseClasses} bg-blue-500 text-white`
  if (status === 'completed')
    return `${baseClasses} bg-green-500 text-white`
  return `${baseClasses} bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400`
}

/**
 * Gets class for connector line
 */
function getConnectorClass(stepIndex: number): string {
  const baseClasses = 'h-0.5 w-6 bg-gray-200 dark:bg-gray-700'
  const currentIndex = props.steps.findIndex(s => s.id === props.currentStep)

  if (stepIndex < currentIndex)
    return `${baseClasses} bg-green-500 dark:bg-green-600`
  return baseClasses
}
</script>

<template>
  <div class="flex justify-center">
    <div class="flex items-center space-x-4">
      <template v-for="(step, index) in steps" :key="step.id">
        <!-- Step indicator -->
        <div class="flex flex-col items-center">
          <div
            :class="getStepClass(getStepStatus(step))"
          >
            <div class="h-4 w-4" :class="step.icon" />
          </div>
          <span class="mt-1 text-xs text-gray-600 dark:text-gray-400">{{ step.label }}</span>
        </div>

        <!-- Connector line -->
        <div
          v-if="connected && index < steps.length - 1"
          :class="getConnectorClass(index)"
        />
      </template>
    </div>
  </div>
</template>
