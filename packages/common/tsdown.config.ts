import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: [
    './src/index.ts',
    './src/composable/index.ts',
  ],
  sourcemap: true,
  exports: {
    devExports: true,
  },
  fixedExtension: true,
})
