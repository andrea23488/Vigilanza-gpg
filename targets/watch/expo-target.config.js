/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = config => ({
  type: "watch",
  name: "VigilanzaGPG",
  displayName: "Vigilanza GPG",
  icon: "./icon.png",
  colors: { $accent: "green" },
  deploymentTarget: "10.0",
  bundleIdentifier: ".watch",
  entitlements: {
    "com.apple.security.application-groups": ["group.com.vigilanzagpg.app.watch"],
  },
});
