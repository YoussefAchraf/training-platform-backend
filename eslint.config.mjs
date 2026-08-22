import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';
import boundaries from 'eslint-plugin-boundaries';















const boundariesElements = [
  
  
  
  
  { type: 'composition-root', pattern: 'src/app.ts', partialMatch: false },
  { type: 'composition-root', pattern: 'src/server.ts', partialMatch: false },
  { type: 'docs', pattern: 'src/docs/**' },
  { type: 'interface', pattern: 'src/interface/**' },
  { type: 'use-cases', pattern: 'src/use-cases/**' },
  { type: 'infrastructure', pattern: 'src/infrastructure/**' },
  { type: 'domain', pattern: 'src/domain/**' },
  
  
  { type: 'generated', pattern: 'src/generated/**' },
];

export default tseslint.config(
  {
    
    
    
    ignores: [
      'dist/**',
      'node_modules/**',
      'docs/**',
      'coverage/**',
      'ecosystem.config.js',
      'jest.config.js',
      
      'src/generated/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ['src/**/*.ts', 'scripts/**/*.ts', 'tests/**/*.ts'],

    languageOptions: {
      parserOptions: {
        project: './tsconfig.eslint.json',
        tsconfigRootDir: import.meta.dirname,
        sourceType: 'module',
      },
      globals: {
        process: 'readonly',
        console: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
      },
    },

    plugins: {
      import: importPlugin,
    },

    settings: {
      'import/resolver': {
        typescript: {
          project: './tsconfig.eslint.json',
        },
      },
    },

    rules: {
      
      
      
      'import/no-cycle': 'error',

      
      
      
      
      
      
      '@typescript-eslint/no-explicit-any': 'warn',

      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',

      'import/order': [
        'warn',
        {
          groups: ['builtin', 'external', ['internal', 'parent', 'sibling', 'index']],
          
          
          
          
          'newlines-between': 'ignore',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
    },
  },

  
  
  
  {
    files: ['src/**/*.ts'],
    plugins: { boundaries },
    settings: {
      'boundaries/elements': boundariesElements,
    },
    rules: {
      
      
      
      
      
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          policies: [
            {
              from: { element: { type: 'domain' } },
              allow: { to: { element: { type: 'domain' } } },
            },
            {
              from: { element: { type: 'use-cases' } },
              allow: { to: { element: { type: ['domain', 'use-cases'] } } },
            },
            {
              from: { element: { type: 'infrastructure' } },
              allow: { to: { element: { type: ['domain', 'infrastructure', 'generated'] } } },
            },
            {
              from: { element: { type: 'interface' } },
              allow: { to: { element: { type: ['domain', 'use-cases', 'interface'] } } },
            },
            {
              from: { element: { type: 'docs' } },
              
              
              
              allow: { to: { element: { type: ['docs', 'interface'] } } },
            },
            {
              from: { element: { type: 'composition-root' } },
              allow: {
                to: {
                  element: {
                    type: ['domain', 'use-cases', 'infrastructure', 'interface', 'docs'],
                  },
                },
              },
            },
          ],
        },
      ],
    },
  },

  
  
  
  
  
  
  
  {
    files: ['src/domain/interfaces/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },

  
  
  
  
  {
    files: ['scripts/*.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        require: 'readonly',
        module: 'writable',
        exports: 'writable',
        process: 'readonly',
        console: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  }
);
