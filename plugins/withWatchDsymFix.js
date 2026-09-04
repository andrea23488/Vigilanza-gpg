const { withMod } = require('expo/config-plugins');

module.exports = function withWatchDsymFix(config) {
  return withMod(config, {
    platform: 'ios',
    mod: 'xcodeProjectBeta2',
    action: async (config) => {
      const project = config.modResults;
      let modificati = 0;

      for (const target of project.rootObject.props.targets || []) {
        const productName = String(target?.props?.productName || '');

        if (productName !== 'VigilanzaGPG') continue;

        const buildConfigs =
          target?.props?.buildConfigurationList?.props?.buildConfigurations || [];

        for (const buildConfig of buildConfigs) {
          const settings = buildConfig?.props?.buildSettings;
          if (!settings) continue;

          settings.DEBUG_INFORMATION_FORMAT = 'dwarf';
          modificati++;
        }
      }

      console.log(
        `[withWatchDsymFix] configurazioni Watch modificate: ${modificati}`
      );

      return config;
    },
  });
};
