const { createHash } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const OFFICIAL = {
  projectId: '3f83a3a9-df1a-4dcc-beaf-8c390f52eca2',
  bundleId: 'com.vigilanzagpg.app',
  backend: 'https://wzdwmiewinsbvqgtmwei.supabase.co',
};
module.exports = ({ config }) => {
  if (config.ios?.bundleIdentifier !== OFFICIAL.bundleId || config.android?.package !== OFFICIAL.bundleId || config.extra?.eas?.projectId !== OFFICIAL.projectId || config.slug !== 'Vigilanza-gpg') {
    throw new Error('Identità ufficiale Vigilanza GPG non valida.');
  }
  if (config.extra?.offlineTest || config.extra?.privateIosRealTest || config.extra?.fullCandidateBeta) throw new Error('Modalità privata/Beta/offline non ammessa nella build ufficiale.');
  if (process.env.EAS_BUILD || process.env.EAS_BUILD_PROFILE) {
    if (String(process.env.EXPO_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '') !== OFFICIAL.backend) throw new Error('Build bloccata: verificare il backend Supabase ufficiale.');
    if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '')) throw new Error('Build bloccata: manca la chiave pubblica Supabase verificata.');
  }
  const hash = createHash('sha256');
  for (const file of ['App.js', 'OfficialCalendar.js', 'turniApi.js', 'turniRapidiOperazioni.js', 'games/SpacePatrolGame.js', 'games/BriscolaPlayLayout.js', 'games/ScopaPlayLayout.js', 'FeedbackScreen.js']) hash.update(readFileSync(join(__dirname, file)));
  return { ...config, extra: { ...config.extra, releaseRevision: 'gpg-coordinato-20261107', sourceHash: hash.digest('hex').slice(0,16), salaryEngine: 'legacy', gpg2Status: 'experimental-unvalidated' } };
};
