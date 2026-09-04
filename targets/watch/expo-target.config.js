/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = config => ({
  type: "watch",
  name: "VigilanzaGPG",
  displayName: "Vigilanza GPG",
  icon: "./icon.png",
  colors: { $accent: "darkcyan" },
  deploymentTarget: "9.4",
  bundleIdentifier: ".watch",
  entitlements: {},
});
