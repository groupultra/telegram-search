import antfu from '@antfu/eslint-config'

export default await antfu({
  vue: true,
  unocss: true,
  ignores: [
    'cspell.config.yaml',
    '**/drizzle/**/*.json',
  ],
  rules: {
    'ts/ban-ts-comment': 'off',
    'import/order': [
      'error',
      {
        'groups': [
          ['type'],
          ['builtin', 'external'],
          ['parent', 'sibling', 'index'],
        ],
        'newlines-between': 'always',
      },
    ],
  },
})
