import config from '@unbird/eslint-config'

export default await config({
  vue: true,
  unocss: true,
  ignores: [
    'cspell.config.yaml',
    '**/drizzle/**/*.json',
    '**/*.md',
  ],
})
