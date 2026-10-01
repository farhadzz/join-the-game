import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/coverage/**', '**/.turbo/**', '**/.next/**', '**/.expo/**'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    files: ['apps/**/*.{ts,tsx}'],
    ...reactHooks.configs.flat.recommended,
  },
  {
    // Tooling configs (Babel, Metro, Tailwind) are CommonJS scripts run by Node.
    files: ['**/*.config.js'],
    ignores: ['eslint.config.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: { module: 'writable', require: 'readonly', __dirname: 'readonly' },
    },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
);
