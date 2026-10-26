const BUNDLE_ID='com.vigilanzagpg.app.beta';
const SCHEME='vigilanzagpg-beta';
const PROFILE='ios-beta';
const EXCLUDED=['expo-notifications','react-native-watch-connectivity','expo-local-authentication','expo-dev-client','expo-updates'];
function assertIdentity(config,nativeId,platform) {
 if(platform!=='ios'||nativeId!==BUNDLE_ID||config?.ios?.bundleIdentifier!==BUNDLE_ID||config?.scheme!==SCHEME||config?.extra?.isolatedBeta!==true||config?.updates?.enabled!==false)throw Error('BETA: identità non isolata. Avvio bloccato.');
}
module.exports={BUNDLE_ID,SCHEME,PROFILE,EXCLUDED,assertIdentity};
