const path=require('node:path');
module.exports=api=>{api.cache(true);const expoRoot=path.dirname(require.resolve('expo/package.json'));return{presets:[require.resolve('babel-preset-expo',{paths:[expoRoot]})]}};
