/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = config => ({
  type: "watch-widget",
  name: "VigilanzaGPGComplication",
  displayName: "Vigilanza GPG",
  deploymentTarget: "9.4",
  bundleIdentifier: ".watch.complication",
  entitlements: {
    "com.apple.security.application-groups": ["group.com.vigilanzagpg.app.watch"],
  },
});
