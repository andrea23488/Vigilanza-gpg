const fs = require('fs');
const path = require('path');
const { withXcodeProject } = require('@expo/config-plugins');

const TARGET_NAME = 'VigilanzaWatch';
const WATCH_DIRECTORY = 'VigilanzaWatch';
// Modern single-target watchOS apps are ordinary application targets whose
// platform/build settings point at watchOS. Using the legacy watch2_app product
// type can make Xcode generate the Watch executable twice during archive.
const WATCH_PRODUCT_TYPE = 'com.apple.product-type.application';
const DEFAULT_DEPLOYMENT_TARGET = '10.0';
const OWNED_FILES = [
  { name: 'VigilanzaWatchApp.swift', phase: 'Sources' },
  { name: 'ContentView.swift', phase: 'Sources' },
  { name: 'Assets.xcassets', phase: 'Resources' },
  { name: 'Info.plist' },
  { name: 'VigilanzaWatch.entitlements' },
];

function unquote(value = '') {
  return String(value).replace(/^"|"$/g, '');
}

function findTarget(project, name) {
  const targets = project.pbxNativeTargetSection();
  const key = Object.keys(targets).find(
    (candidate) =>
      !candidate.endsWith('_comment') && unquote(targets[candidate].name) === name
  );

  return key ? { uuid: key, pbxNativeTarget: targets[key] } : null;
}

function copyWatchSources(projectRoot, iosRoot) {
  const source = path.join(projectRoot, 'watch', WATCH_DIRECTORY);
  const destination = path.join(iosRoot, WATCH_DIRECTORY);

  if (!fs.existsSync(source)) {
    throw new Error(`Watch source directory not found: ${source}`);
  }

  fs.rmSync(destination, { recursive: true, force: true });
  fs.cpSync(source, destination, { recursive: true });
}

function configureEasAppExtension(config, bundleIdentifier) {
  const extra = { ...(config.extra || {}) };
  const eas = { ...(extra.eas || {}) };
  const build = { ...(eas.build || {}) };
  const experimental = { ...(build.experimental || {}) };
  const ios = { ...(experimental.ios || {}) };
  const appExtensions = Array.isArray(ios.appExtensions)
    ? [...ios.appExtensions]
    : [];
  const declaration = { targetName: TARGET_NAME, bundleIdentifier };
  const index = appExtensions.findIndex(
    (extension) => extension?.targetName === TARGET_NAME
  );

  if (index === -1) {
    appExtensions.push(declaration);
  } else {
    appExtensions[index] = { ...appExtensions[index], ...declaration };
  }

  config.extra = {
    ...extra,
    eas: {
      ...eas,
      build: {
        ...build,
        experimental: {
          ...experimental,
          ios: { ...ios, appExtensions },
        },
      },
    },
  };
  return config;
}

function findWatchGroup(project) {
  const groups = project.hash.project.objects.PBXGroup;
  const uuid = Object.keys(groups).find((key) => {
    if (key.endsWith('_comment')) return false;
    const group = groups[key];
    return (
      unquote(group.name) === TARGET_NAME ||
      unquote(group.path) === WATCH_DIRECTORY
    );
  });
  return uuid ? { uuid, group: groups[uuid] } : null;
}

function ensureWatchGroup(project) {
  const existing = findWatchGroup(project);
  if (existing) {
    existing.group.name = TARGET_NAME;
    existing.group.path = WATCH_DIRECTORY;
    return existing.uuid;
  }

  const uuid = project.pbxCreateGroup(TARGET_NAME, WATCH_DIRECTORY);
  project.addToPbxGroup(uuid, project.getFirstProject().firstProject.mainGroup);
  return uuid;
}

function ensureBuildPhase(project, targetUuid, type, name) {
  const target = project.pbxNativeTargetSection()[targetUuid];
  const hasTargetPhase = target.buildPhases.some(({ comment }) => comment === name);
  if (!hasTargetPhase) {
    project.addBuildPhase([], type, name, targetUuid);
  }
}

function ensureContainerAssociation(project, containerTarget, watchTarget) {
  const dependencies =
    project.hash.project.objects.PBXTargetDependency || {};
  const hasDependency = containerTarget.firstTarget.dependencies.some(
    ({ value }) => dependencies[value]?.target === watchTarget.uuid
  );
  if (!hasDependency) {
    project.addTargetDependency(containerTarget.uuid, [watchTarget.uuid]);
  }

  let copyPhases = project.hash.project.objects.PBXCopyFilesBuildPhase || {};
  let embedPhaseReference = containerTarget.firstTarget.buildPhases.find(
    ({ value, comment }) =>
      comment === 'Embed Watch Content' ||
      unquote(copyPhases[value]?.name) === 'Embed Watch Content'
  );

  if (!embedPhaseReference) {
    const result = project.addBuildPhase(
      [`${TARGET_NAME}.app`],
      'PBXCopyFilesBuildPhase',
      'Embed Watch Content',
      containerTarget.uuid,
      'watch2_app',
      '"$(CONTENTS_FOLDER_PATH)/Watch"'
    );
    embedPhaseReference = { value: result.uuid, comment: 'Embed Watch Content' };
    copyPhases = project.hash.project.objects.PBXCopyFilesBuildPhase;
  }

  const embedPhase = copyPhases[embedPhaseReference.value];
  embedPhase.name = '"Embed Watch Content"';
  embedPhase.dstPath = '"$(CONTENTS_FOLDER_PATH)/Watch"';
  embedPhase.dstSubfolderSpec = 16;

  const buildFiles = project.pbxBuildFileSection();
  let productBuildFileUuid = Object.keys(buildFiles).find(
    (key) =>
      !key.endsWith('_comment') &&
      buildFiles[key].fileRef === watchTarget.pbxNativeTarget.productReference
  );
  if (!productBuildFileUuid) {
    productBuildFileUuid = project.generateUuid();
    buildFiles[productBuildFileUuid] = {
      isa: 'PBXBuildFile',
      fileRef: watchTarget.pbxNativeTarget.productReference,
      fileRef_comment: `${TARGET_NAME}.app`,
    };
    buildFiles[`${productBuildFileUuid}_comment`] =
      `${TARGET_NAME}.app in Embed Watch Content`;
  }
  if (!embedPhase.files.some(({ value }) => value === productBuildFileUuid)) {
    embedPhase.files.push({
      value: productBuildFileUuid,
      comment: `${TARGET_NAME}.app in Embed Watch Content`,
    });
  }
}

function removeOwnedFile(project, groupUuid, fileName) {
  const group = project.getPBXGroupByKey(groupUuid);
  const fileReferences = project.pbxFileReferenceSection();
  const ownedReferenceUuids = group.children
    .filter(({ value, comment }) => {
      const reference = fileReferences[value];
      return (
        unquote(comment) === fileName ||
        (reference && unquote(reference.path) === fileName)
      );
    })
    .map(({ value }) => value);

  if (ownedReferenceUuids.length === 0) return;

  const buildFiles = project.pbxBuildFileSection();
  const ownedBuildFileUuids = Object.keys(buildFiles).filter(
    (key) =>
      !key.endsWith('_comment') &&
      ownedReferenceUuids.includes(buildFiles[key].fileRef)
  );

  ['PBXSourcesBuildPhase', 'PBXResourcesBuildPhase'].forEach((sectionName) => {
    const section = project.hash.project.objects[sectionName] || {};
    Object.keys(section).forEach((key) => {
      if (!key.endsWith('_comment') && Array.isArray(section[key].files)) {
        section[key].files = section[key].files.filter(
          ({ value }) => !ownedBuildFileUuids.includes(value)
        );
      }
    });
  });

  ownedBuildFileUuids.forEach((uuid) => {
    delete buildFiles[uuid];
    delete buildFiles[`${uuid}_comment`];
  });
  ownedReferenceUuids.forEach((uuid) => {
    delete fileReferences[uuid];
    delete fileReferences[`${uuid}_comment`];
  });
  group.children = group.children.filter(
    ({ value }) => !ownedReferenceUuids.includes(value)
  );
}

function reconcileFiles(project, targetUuid, groupUuid) {
  OWNED_FILES.forEach(({ name }) => removeOwnedFile(project, groupUuid, name));

  OWNED_FILES.forEach(({ name, phase }) => {
    if (phase === 'Sources') {
      project.addSourceFile(name, { target: targetUuid }, groupUuid);
    } else if (phase === 'Resources') {
      const file = project.addFile(name, groupUuid);
      file.target = targetUuid;
      file.uuid = project.generateUuid();
      project.addToPbxBuildFileSection(file);
      project.addToPbxResourcesBuildPhase(file);
    } else {
      project.addFile(name, groupUuid);
    }
  });
}

function reconcileBuildSettings(
  project,
  target,
  containerTarget,
  bundleIdentifier,
  companionBundleIdentifier,
  deploymentTarget
) {
  const configurationList = project.pbxXCConfigurationList()[
    target.pbxNativeTarget.buildConfigurationList
  ];
  const configurations = project.pbxXCBuildConfigurationSection();
  const containerConfigurationList = project.pbxXCConfigurationList()[
    containerTarget.firstTarget.buildConfigurationList
  ];
  const containerConfigurationsByName = new Map(
    containerConfigurationList.buildConfigurations.map(({ value }) => [
      unquote(configurations[value].name),
      configurations[value],
    ])
  );

  configurationList.buildConfigurations.forEach(({ value }) => {
    const configuration = configurations[value];
    const containerConfiguration = containerConfigurationsByName.get(
      unquote(configuration.name)
    );
    if (!containerConfiguration) {
      throw new Error(
        `The iOS container has no ${unquote(configuration.name)} configuration.`
      );
    }
    for (const versionSetting of [
      'CURRENT_PROJECT_VERSION',
      'MARKETING_VERSION',
    ]) {
      if (containerConfiguration.buildSettings[versionSetting] == null) {
        throw new Error(
          `The iOS container ${unquote(configuration.name)} configuration has no ${versionSetting}.`
        );
      }
    }
    const settings = configurations[value].buildSettings;
    settings.ASSETCATALOG_COMPILER_APPICON_NAME = 'AppIcon';
    settings.CODE_SIGN_ENTITLEMENTS = `${WATCH_DIRECTORY}/VigilanzaWatch.entitlements`;
    settings.CURRENT_PROJECT_VERSION =
      containerConfiguration.buildSettings.CURRENT_PROJECT_VERSION;
    settings.GENERATE_INFOPLIST_FILE = 'NO';
    settings.INFOPLIST_FILE = `${WATCH_DIRECTORY}/Info.plist`;
    settings.MARKETING_VERSION =
      containerConfiguration.buildSettings.MARKETING_VERSION;
    settings.PRODUCT_BUNDLE_IDENTIFIER = bundleIdentifier;
    settings.SDKROOT = 'watchos';
    settings.SUPPORTED_PLATFORMS = '"watchos watchsimulator"';
    settings.SWIFT_VERSION = '5.0';
    settings.TARGETED_DEVICE_FAMILY = '4';
    settings.WATCH_COMPANION_APP_BUNDLE_IDENTIFIER = companionBundleIdentifier;
    settings.WATCHOS_DEPLOYMENT_TARGET = deploymentTarget;
  });
}

function addOrReconcileWatchTarget(
  project,
  bundleIdentifier,
  companionBundleIdentifier,
  deploymentTarget
) {
  const containerTarget = project.getFirstTarget();
  project.hash.project.objects.PBXTargetDependency ||= {};
  project.hash.project.objects.PBXContainerItemProxy ||= {};
  let target = findTarget(project, TARGET_NAME);
  if (target) {
    if (unquote(target.pbxNativeTarget.productType) !== WATCH_PRODUCT_TYPE) {
      throw new Error(`${TARGET_NAME} exists but is not a watchOS app target.`);
    }
  } else {
    target = project.addTarget(
      TARGET_NAME,
      'application',
      WATCH_DIRECTORY,
      bundleIdentifier
    );
  }

  ensureBuildPhase(project, target.uuid, 'PBXSourcesBuildPhase', 'Sources');
  ensureBuildPhase(project, target.uuid, 'PBXResourcesBuildPhase', 'Resources');
  ensureBuildPhase(project, target.uuid, 'PBXFrameworksBuildPhase', 'Frameworks');
  ensureContainerAssociation(project, containerTarget, target);
  const groupUuid = ensureWatchGroup(project);
  reconcileFiles(project, target.uuid, groupUuid);
  reconcileBuildSettings(
    project,
    target,
    containerTarget,
    bundleIdentifier,
    companionBundleIdentifier,
    deploymentTarget
  );
  project.addTargetAttribute('CreatedOnToolsVersion', '16.0', target);
  return target;
}

function withVigilanzaWatch(config, options = {}) {
  const iosBundleIdentifier = config.ios?.bundleIdentifier;
  if (!iosBundleIdentifier) {
    throw new Error('ios.bundleIdentifier is required to create the Watch target.');
  }

  const watchBundleIdentifier =
    options.bundleIdentifier || `${iosBundleIdentifier}.watchkitapp`;
  const deploymentTarget = options.deploymentTarget || DEFAULT_DEPLOYMENT_TARGET;

  configureEasAppExtension(config, watchBundleIdentifier);

  return withXcodeProject(config, (configWithProject) => {
    copyWatchSources(
      configWithProject.modRequest.projectRoot,
      configWithProject.modRequest.platformProjectRoot
    );
    addOrReconcileWatchTarget(
      configWithProject.modResults,
      watchBundleIdentifier,
      iosBundleIdentifier,
      deploymentTarget
    );
    return configWithProject;
  });
}

module.exports = withVigilanzaWatch;
module.exports._internal = {
  addOrReconcileWatchTarget,
  configureEasAppExtension,
  copyWatchSources,
  findTarget,
};
