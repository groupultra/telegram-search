<template>
  <div class="min-h-screen flex flex-col items-center justify-center bg-white dark:bg-gray-900">
    <div class="animate-bounce">
      <div class="text-8xl text-gray-900 dark:text-gray-100">
        <i class="i-lucide-circle-alert" />
      </div>
      <h1 class="text-6xl text-gray-900 font-bold dark:text-gray-100">
        404
      </h1>
    </div>
    <p class="mt-4 animate-fade-in text-xl text-gray-600 dark:text-gray-400">
      Page not found
    </p>
    <RouterLink
      to="/"
      class="mt-8 flex items-center gap-2 text-primary transition-colors duration-200 hover:text-primary/80"
    >
      <i class="i-lucide-house" />
      <span>Return to Home</span>
    </RouterLink>
  </div>
</template>
