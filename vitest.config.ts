import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      'packages/client',
      'packages/common',
      'packages/core',
      'apps/server',
      'apps/web',
    ],
    environment: 'happy-dom',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: [
        'packages/**/src/**/*.ts',
      ],
      exclude: [
        'packages/**/src/**/*.test.ts',
        'packages/**/src/**/*.spec.ts',
      ],
    },
  },
})
