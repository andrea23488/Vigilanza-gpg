const {isTest,validateEnvironment,TEST_BUNDLE}=require('./scripts/push-test-policy.cjs');
module.exports=({config})=>{
 // Existing profiles return the supplied Expo config unchanged.
 if(!isTest(process.env))return config;
 validateEnvironment(process.env,{configOnly:true});
 if(config.extra?.eas?.projectId!==process.env.EXPO_PUBLIC_PUSH_PROJECT_ID)throw Error('Progetto EAS TEST incoerente');
 const test=JSON.parse(JSON.stringify(config));
 test.name='Vigilanza GPG — Push TEST';
 test.scheme='vigilanzagpg-pushtest';
 test.platforms=['ios'];
 test.ios={...test.ios,bundleIdentifier:TEST_BUNDLE,entitlements:{...test.ios?.entitlements}};
 delete test.ios.entitlements['com.apple.security.application-groups'];
 delete test.ios.entitlements['keychain-access-groups'];
 // Without apple-targets, targets/watch and targets/watch-widget are not generated.
 test.plugins=(test.plugins||[]).filter(p=>(Array.isArray(p)?p[0]:p)!=='@bacons/apple-targets');
 // Keep the dev-client dependency from adding the shared exp+slug URL scheme.
 test.plugins=test.plugins.filter(p=>(Array.isArray(p)?p[0]:p)!=='expo-dev-client');
 test.plugins.push(['expo-dev-client',{addGeneratedScheme:false}]);
 const extraIos=test.extra?.eas?.build?.experimental?.ios;
 if(extraIos)delete extraIos.appExtensions;
 return test;
};
