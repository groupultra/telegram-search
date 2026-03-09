<script setup lang="ts">
import { breakpointsTailwind, useBreakpoints } from '@vueuse/core'
import { defineAsyncComponent } from 'vue'

const LoginMobile = defineAsyncComponent(() => import('./login/LoginMobile.vue'))
const LoginDesktop = defineAsyncComponent(() => import('./login/LoginDesktop.vue'))

const breakpoints = useBreakpoints(breakpointsTailwind)
const isMobile = breakpoints.smaller('md')
</script>

<template>
  <LoginMobile v-if="isMobile" />
  <LoginDesktop v-else />
</template>
