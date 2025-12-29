import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: [
      'src/**/*.test.ts',
      'src/**/*.spec.ts',
    ],
    setupFiles: [
      './src/mock/setup-test.ts',
    ],
    environment: 'happy-dom',
  },
})
