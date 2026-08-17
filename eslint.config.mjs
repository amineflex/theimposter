import coreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'

/**
 * Configuration ESLint « flat » (ESLint 9).
 *
 * Next.js 16 a supprimé la commande `next lint` : le lint passe désormais par
 * l'ESLint CLI (`npm run lint`) et n'est plus exécuté pendant `next build`.
 *
 * ESLint 10 n'est pas encore utilisable ici : `eslint-plugin-react` (embarqué par
 * `eslint-config-next`) déclare `eslint ^9.7` au maximum et plante sur la v10.
 */
const config = [
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'supabase/**',
      'public/sw.js',
      'test-results/**',
      'playwright-report/**',
      '.npm-cache/**',
    ],
  },
  ...coreWebVitals,
  ...nextTypescript,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
]

export default config
