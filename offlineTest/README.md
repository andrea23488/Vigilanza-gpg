# Vigilanza GPG Test — offline iOS preparation

This variant tests the real Nuova giornata and Consegne di servizio screens.
It is not an authentication, backend, push, Watch or salary integration test.
No native build or Apple/EAS resource has been created by this change.

## Identity and configuration

- Select `APP_VARIANT=offline-test` and `EXPO_NO_DOTENV=1` before loading Expo/Metro.
- The dedicated EAS profile is `offline-test`: internal distribution, Release, no dev client.
- Clear `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
  Nonempty values cause configuration to fail; local `.env*` files are excluded from the Test source copy and its upload.
- Name: Vigilanza GPG Test; bundle ID: com.vigilanzagpg.app.test; scheme: vigilanzagpg-test.
- The native ExpoApplication ID must match the test manifest. A JS flag alone cannot enable Test
  in the official binary. Expo Go and browser previews cannot enable this native-only mode.
- A future build requires `OFFLINE_EAS_PROJECT_ID` for a dedicated EAS project. There is no
  default and the production project ID is rejected. No new project has been registered.
- Watch targets, shared App Groups and push plugins are excluded only for Test. A Test-only
  config plugin also prevents automatic notification capability setup and strips shared groups.
- Do not reuse generated native directories from the official variant. Inspect future native
  output and signed entitlements before any device installation. Do not revoke existing signing assets.
- SDK/dependencies and the base app.json are unchanged. Default configuration is production.

## External source copy and native exclusion

The repository has no `.easignore`, restoring EAS's original `.gitignore` fallback for
official uploads. EAS ignore rules are not selected per build profile. Test-only rules
must not be added to the repository's upload policy.

`node scripts/prepare-offline-stage.cjs` prepares a new directory under the system temporary
directory. It never invokes EAS, builds, installs packages or accesses external services.
It copies the current tracked source plus the known offline preparation files, excluding
environment files, personal tool settings, signing assets, generated native directories,
Watch targets and Supabase deployment files. It rejects source symlinks. The destination
is always new; existing files in the repository are never rewritten.

Only this external copy gets a restrictive `.easignore`, an `offline-test`-only eas.json,
and a package.json marker with `expo.autolinking.ios.exclude` containing
`expo-notifications` and `react-native-watch-connectivity`. SDK 54's installed autolinker
supports exclusions for both Expo modules and React Native modules. This prevents these
native modules from being selected for linking, rather than merely hiding their JS APIs.
Only the copy's react-native.config.js gains iOS set to null for these modules,
so React Native's codegen fallback knows they are disabled too. Existing settings,
including the Watch Android exclusion, are preserved. The repository's original file
is unchanged.
Dependencies and lockfiles in the repository remain unchanged; the external package
metadata changes neither dependency versions nor the lockfile.

Any subsequent native preparation/build must use that copy with APP_VARIANT=offline-test,
EXPO_NO_DOTENV=1, empty Supabase variables and a dedicated OFFLINE_EAS_PROJECT_ID.
The stage marker requires the offline variant even if EAS_BUILD_PROFILE is absent.
The offline-test profile requires the variant even outside the copy; actual EAS build
configuration additionally requires the stage marker and native exclusions. Missing,
empty or incorrect variant values stop preparation instead of selecting the official app.
The source copy is a snapshot: prepare a fresh copy after any source change.
The Test configuration rejects EXPO_USE_COMMUNITY_AUTOLINKING=1, which would bypass
Expo's React Native exclusion mechanism. No such restriction is added to the official variant.

Do not run native preparation in the repository for Test, and do not reuse any generated
native directories or Pods from an official build. The future native project must be
generated fresh from the isolated copy and its signed capabilities reviewed separately.

## Runtime behavior

The entry point installs the network deny guard before requiring App. It blocks fetch,
XMLHttpRequest, WebSocket and EventSource without calling their original implementations.
A resolver marker also stops startup before App if the offline binary receives a bundle made
with the normal Metro resolver. Offline Metro resolution replaces Supabase, direct turn REST APIs, push and native Watch
imports with isolated services. Those services never create an SDK client or authenticated
session, return empty read data, and reject cloud mutations/authentication/token requests.
Native push/reminder APIs are substituted too. There is no real Supabase URL or credential
needed, no fake access/refresh token, and no EAS Update configured for Test.

The Test launcher uses the real `nuovoGiorno` handler. Strumenti and its real
`setScreen('consegneServizio')` route remain in use; the real handover component receives
paletteHome at its original mount. Other app screens return to the Test launcher.
The profile is a labeled fictitious fixture; colleagues/turns start empty.

Save day, apply period and send handover show an explicit disabled alert. They do not report
simulated backend success. Quick-shift templates and handover archives still use their real
local persistence, in the dedicated app container only. Local copy/export remain real user
operations on fictitious content; do not enter personal or operational data.

## Verification without a native build

Run `npm run typecheck` and `git diff --check`.
Run `node scripts/test-offline-mode.cjs` for identity/configuration, Metro routing,
transport blocking, cloud denials, real handover rendering and blocked-handler checks.
Run `node scripts/test-offline-safety.cjs` for external-copy filtering, fail-closed build
intent and real installed Expo/RN autolinking checks. The test temporarily links the existing
node_modules into its new temporary source copy and removes that link afterward. It does
not run CocoaPods, prebuild or a native build. No dependencies are installed.
For the production-path AST comparison, pass the baseline App.js source as the script's
first argument (a read-only `git show` can save that baseline outside the repository).

Node tests do not establish native signing, module autolinking, iPhone rendering, device
network behavior, keyboard usability or persistence across actual native app restarts.
Those must be verified after separate authorization for provisioning/build/installation.
The global JavaScript guard is defense in depth; future native output must still be inspected
for unexpected native services/capabilities. No production device data should ever be imported.
