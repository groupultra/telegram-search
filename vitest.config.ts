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
  },
})
