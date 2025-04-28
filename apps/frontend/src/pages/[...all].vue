<template>
  <div class="min-h-screen flex flex-col items-center justify-center">
    <div class="animate-bounce">
      <div class="text-foreground text-8xl">
        <i class="i-lucide-circle-alert" />
      </div>
      <h1 class="text-foreground text-6xl font-bold">
        404
      </h1>
    </div>
    <p class="text-secondary-foreground mt-4 animate-fade-in text-xl">
      Page not found
    </p>
    <RouterLink
      to="/"
      class="text-primary hover:text-primary/80 mt-8 flex items-center gap-2 transition-colors duration-200"
    >
      <i class="i-lucide-house" />
      <span>Return to Home</span>
    </RouterLink>
  </div>
</template>
