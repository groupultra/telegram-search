import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/node.ts',
  ],
  dts: true,
  sourcemap: true,
  unused: true,
  fixedExtension: true,
})
