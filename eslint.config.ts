import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';

export default tseslint.config(
  // グローバル無視設定
  {
    ignores: ['node_modules/**', 'out/**', '.vite/**', 'dist/**', 'src/renderer/dist/**'],
  },

  // ベースルール（全 JS/TS ファイル）
  js.configs.recommended,

  // TypeScript ルール
  ...tseslint.configs.recommended,

  // React レンダラー向け設定
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      ...reactHooksPlugin.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off', // React 17+ JSX Transform
      'react/prop-types': 'off', // TypeScript で型チェックを行う
    },
  },
);
