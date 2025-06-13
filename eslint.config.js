import tseslint from 'typescript-eslint'
import js from '@eslint/js'
import globals from 'globals'

export default tseslint.config(
  // 基础配置
  {
    files: ['lib/**/*.ts', 'main.ts'],
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },

  // 继承推荐配置
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // 自定义规则覆盖
  {
    files: ['lib/**/*.ts', 'main.ts'],
    rules: {
      '@typescript-eslint/no-non-null-asserted-optional-chain': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      'no-fallthrough': 'off',
    },
  },
)
