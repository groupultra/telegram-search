import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: [
      'src/**/*.test.ts',
      'src/**/*.spec.ts',
    ],
    setupFiles: [
      './mock/setupTest.ts',
    ],
  },
})
