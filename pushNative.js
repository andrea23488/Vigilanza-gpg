// Caricamento lazy: nessun modulo nativo nuovo viene invocato con push disabilitate.
export function providerPushNativo() {
  let store, crypto;
  const storage = async () => {
    store ||= await import('expo-secure-store');
    if (!(await store.isAvailableAsync())) throw Error('Archivio sicuro non disponibile');
    return store;
  };
  return {
    secureStorage: {
      async get(key) { return (await storage()).getItemAsync(key); },
      async set(key,value) {
        const s=await storage();
        await s.setItemAsync(key,value,{keychainAccessible:s.WHEN_UNLOCKED_THIS_DEVICE_ONLY});
      },
    },
    async randomBytes(length) {
      crypto ||= await import('expo-crypto');
      return crypto.getRandomBytesAsync(length);
    },
  };
}
