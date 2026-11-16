<template>
  <div class="flex flex-col items-center justify-center gap-6 bg-container p-6 text-center min-h-dvh">
    <p class="text-xs text-fg-3 tracking-wider font-mono">
      404
    </p>
    <h1 class="text-2xl text-fg font-semibold">
      Page not found
    </h1>
    <RouterLink
      to="/"
      class="h-9 inline-flex items-center gap-2 border border-line-2 rounded-lg px-4 text-sm text-fg transition-colors hover:bg-fill-2"
    >
      <i class="i-lucide-arrow-left h-4 w-4" />
      <span>Return to Home</span>
    </RouterLink>
  </div>
</template>
