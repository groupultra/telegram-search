import { defineConfig } from '@moeru/eslint-config'

const config = defineConfig({
  masknet: false,
  preferArrow: false,
  perfectionist: false,
  sonarjs: true,
  sortPackageJsonScripts: false,
  typescript: true,
  unocss: true,
  vue: true,
}, {
  ignores: [
    'cspell.config.yaml',
    'cspell.config.yml',
    '**/drizzle/**',
    '**/*.md',
    '**/*.mdc',
  ],
}, {
  rules: {
    'antfu/import-dedupe': 'error',
    'import/order': 'off',
    'no-console': ['error', { allow: ['warn', 'error', 'info'] }],
    'perfectionist/sort-imports': [
      'error',
      {
        groups: [
          'type-builtin',
          'type-import',
          'type-internal',
          ['type-parent', 'type-sibling', 'type-index'],
          'default-value-builtin',
          'named-value-builtin',
          'value-builtin',
          'default-value-external',
          'named-value-external',
          'value-external',
          'default-value-internal',
          'named-value-internal',
          'value-internal',
          ['default-value-parent', 'default-value-sibling', 'default-value-index'],
          ['named-value-parent', 'named-value-sibling', 'named-value-index'],
          ['wildcard-value-parent', 'wildcard-value-sibling', 'wildcard-value-index'],
          ['value-parent', 'value-sibling', 'value-index'],
          'side-effect',
          'style',
        ],
        newlinesBetween: 'always',
      },
    ],
    'sonarjs/no-dead-store': 'off',
    'sonarjs/cognitive-complexity': 'off',
    // 'sonarjs/no-commented-code': 'off',
    // 'sonarjs/pseudo-random': 'off',
    'sonarjs/todo-tag': 'off',
    'style/padding-line-between-statements': 'error',
    'vue/prefer-separate-static-class': 'off',
    'yaml/plain-scalar': 'off',
    // '@typescript-eslint/no-explicit-any': 'warn',
  },
})

export default config
