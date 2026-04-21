module.exports = {
  rules: {
    'no-unknown-key': require('./rules/no-unknown-key'),
    'valid-icu-message': require('./rules/valid-icu-message')
  },
  configs: {
    recommended: {
      plugins: ['@xiaode-ai/i18nt'],
      rules: {
        '@xiaode-ai/i18nt/no-unknown-key': 'error',
        '@xiaode-ai/i18nt/valid-icu-message': 'warn'
      }
    }
  }
};
