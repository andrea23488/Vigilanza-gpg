let installed = false;
const blocked = [];

export function installOfflineNetworkGuard(target = globalThis) {
  if (installed) return;
  function deny() {
    blocked.push({ at: Date.now(), kind: 'network' });
    throw new Error('TEST OFFLINE: rete disabilitata; nessun dato inviato.');
  }
  const rejectFetch = () => {
    try { deny(); } catch (error) { return Promise.reject(error); }
  };
  for (const [name, replacement] of [
    ['fetch', rejectFetch], ['XMLHttpRequest', deny], ['WebSocket', deny], ['EventSource', deny],
  ]) {
    Object.defineProperty(target, name, { value: replacement, writable: false, configurable: false });
  }
  installed = true;
}

export function getBlockedOfflineRequests() {
  return blocked.map((item) => ({ ...item }));
}
