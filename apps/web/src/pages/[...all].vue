<template>
  <div class="flex flex-col items-center justify-center gap-6 bg-background p-6 text-center min-h-dvh">
    <p class="text-xs text-muted-foreground tracking-wider font-mono">
      404
    </p>
    <h1 class="text-2xl text-foreground font-semibold tracking-tight">
      Page not found
    </h1>
    <RouterLink
      to="/"
      class="h-9 inline-flex items-center gap-2 border border-input rounded-lg px-4 text-sm text-foreground transition-colors hover:bg-accent"
    >
      <i class="i-lucide-arrow-left h-4 w-4" />
      <span>Return to Home</span>
    </RouterLink>
  </div>
</template>
