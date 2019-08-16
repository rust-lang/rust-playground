module.exports = {
  parser: '@typescript-eslint/parser',
  plugins: [
    '@typescript-eslint',
    'react',
    'react-hooks',
  ],
  settings: {
    react: {
      version: 'detect',
    },
  },
  extends: [
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
  ],
  rules:  {
    'comma-dangle': ['error', 'always-multiline'],
    'max-len': ['error', {
      'code': 120,
    }],
    'quotes': ['error', 'single'],

    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/indent': ['error', 2],
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unused-vars': ['error', {
      varsIgnorePattern: "^_",
      argsIgnorePattern: "^_",
    }],
    '@typescript-eslint/no-use-before-define': ['error', {
      functions: false,
      variables: false,
    }],

    'react/jsx-boolean-value': ['error', 'never'],
    'react/jsx-tag-spacing': ['error', {
      "beforeClosing": "never",
    }],
    'react/prop-types': 'off',

    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
  },
};
