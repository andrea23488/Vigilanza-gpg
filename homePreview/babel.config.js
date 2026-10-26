const path = require('node:path');
module.exports = api => {
  api.cache(true);
  return { presets: [require.resolve('babel-preset-expo', { paths: [path.dirname(require.resolve('expo/package.json'))] })] };
};
