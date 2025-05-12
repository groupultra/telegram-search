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
  <div class="flex justify-center gap-6 mb-8">
    <template v-for="(step, idx) in steps" :key="step.value">
      <div class="flex flex-col items-center">
        <div
          class="w-12 h-12 flex items-center justify-center rounded-full border-2 text-xl font-bold transition"
          :class="{
            'bg-primary text-white border-primary shadow-lg': currentStep === step.value,
            'bg-muted text-muted-foreground border-muted': steps.findIndex(s => s.value === currentStep) !== idx,
          }"
        >
          <span>{{ idx + 1 }}</span>
        </div>
      </div>
    </template>
  </div>
</template>
