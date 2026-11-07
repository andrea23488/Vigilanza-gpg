'use strict';
// Nessuna build o scrittura remota: verifica l'identità e che la chiave pubblica
// sia accettata dal backend ufficiale. Le credenziali Apple vanno verificate in EAS.
const fs = require('node:fs');
async function main() {
  const config = require('../app.config.js')({ config: require('../app.json').expo });
  const url = String(process.env.EXPO_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (url !== 'https://wzdwmiewinsbvqgtmwei.supabase.co' || !/^sb_publishable_[A-Za-z0-9_-]+$/.test(key || '')) throw Error('Impostare URL ufficiale e chiave publishable nelle variabili dell’ambiente di build. Nessuna build avviata.');
  const response = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key }, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw Error(`Backend ufficiale: chiave pubblica non verificata (HTTP ${response.status}). Nessuna build avviata.`);
  const settings = await response.json();
  if (!settings || typeof settings !== 'object' || !settings.external) throw Error('Risposta backend non riconosciuta. Nessuna build avviata.');
  console.log(`Identità ufficiale: ${config.ios.bundleIdentifier}; progetto EAS ${config.extra.eas.projectId}. Backend e chiave pubblica verificati.`);
  console.log('Verificare separatamente in EAS account, Team Apple, certificato e provisioning prima di avviare la build.');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
