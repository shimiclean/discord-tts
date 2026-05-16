const neostandard = require('neostandard');

module.exports = neostandard({
  ts: true,
  semi: true,
  globals: ['jest'],
  ignores: ['dist/**', 'node_modules/**']
});
