import { defineConfig } from 'eslint/config'
import tseslint from '@electron-toolkit/eslint-config-ts'
import eslintConfigPrettier from '@electron-toolkit/eslint-config-prettier'
import eslintPluginVue from 'eslint-plugin-vue'
import vueParser from 'vue-eslint-parser'

export default defineConfig(
  { ignores: ['**/node_modules', '**/dist', '**/out'] },
  tseslint.configs.recommended,
  eslintPluginVue.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        ecmaFeatures: {
          jsx: true
        },
        extraFileExtensions: ['.vue'],
        parser: tseslint.parser
      }
    }
  },
  {
    files: ['**/*.{ts,mts,tsx,vue}'],
    rules: {
      'vue/require-default-prop': 'off',
      'vue/multi-word-component-names': 'off',
      'vue/block-lang': [
        'error',
        {
          script: {
            lang: 'ts'
          }
        }
      ]
    }
  },
  // renderer 层（Vue SFC setup + Pinia setup store + composables）关闭强制返回类型
  {
    files: ['src/renderer/**/*.{ts,vue}'],
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'off'
    }
  },
  // 主进程 database.ts 内部辅助函数关闭强制返回类型
  {
    files: ['src/main/**/*.ts'],
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'off'
    }
  },
  // build 脚本允许 require()
  {
    files: ['build/**/*.{js,cjs}'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off'
    }
  },
  // preload 中 window.api 桥接层允许 any
  {
    files: ['src/preload/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off'
    }
  },
  eslintConfigPrettier
)
