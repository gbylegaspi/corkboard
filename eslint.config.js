// Linting: ESLint's recommended rules, with the right globals for each part of the app.
'use strict';
const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  {
    ignores: [
      'node_modules/',
      'dist/',
      'build/',
      'test-results/',
      'tests/.fixtures/',
      'tests/web-host/',
      'src/renderer/vendor/',
      'src/renderer/fonts/',
      'src/renderer/build/',
      'corkboard v*.html'
    ]
  },
  js.configs.recommended,
  {
    rules: {
      'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }],
      'no-empty': ['error', { allowEmptyCatch: true }]
    }
  },
  // the main process, its helpers, build scripts and tests: Node (CommonJS)
  {
    files: ['src/main/**/*.js', 'src/preload/**/*.js', 'scripts/**/*.js', 'tests/**/*.js', '*.js'],
    languageOptions: { sourceType: 'commonjs', globals: { ...globals.node } }
  },
  // the page: browser scripts
  {
    files: ['src/renderer/**/*.js'],
    languageOptions: { sourceType: 'script', globals: { ...globals.browser } }
  },
  // the page's modules (bundled by esbuild)
  {
    files: ['src/renderer/js/**/*.js'],
    languageOptions: { sourceType: 'module', globals: { ...globals.browser } }
  },
  { files: ['src/renderer/desktop/thumb-worker.js'], languageOptions: { globals: { ...globals.worker } } },
  // tests run some functions inside the page
  { files: ['tests/**/*.js'], languageOptions: { globals: { ...globals.browser } } }
];
