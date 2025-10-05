<script setup lang="ts">
export interface Step {
  value: string
  title: string
}
defineProps<{
  steps: Step[]
  currentStep: string
}>()
</script>

<template>
  <div class="mb-8 flex justify-center gap-6">
    <template v-for="(step, idx) in steps" :key="step.value">
      <div class="flex flex-col items-center">
        <div
          class="h-12 w-12 flex items-center justify-center border-2 rounded-full text-xl font-bold transition"
          :class="{
            'border-primary bg-primary text-primary-foreground shadow-lg': currentStep === step.value,
            'border-border bg-muted text-muted-foreground': steps.findIndex(s => s.value === currentStep) !== idx,
          }"
        >
          <span>{{ idx + 1 }}</span>
        </div>
      </div>
    </template>
  </div>
</template>
