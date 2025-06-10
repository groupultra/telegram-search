import { defineConfig } from 'tsdown'

export default defineConfig({
  sourcemap: true,
  exports: {
    devExports: true,
  },
})
