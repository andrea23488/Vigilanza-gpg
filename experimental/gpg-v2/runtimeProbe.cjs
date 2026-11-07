'use strict';

// Nessun polyfill globale e nessun BigInt literal in questo controllo preliminare.
function probeRuntime(env = globalThis) {
  try {
    const O = env.Object, N = env.Number, A = env.Array;
    if (typeof env.BigInt !== 'function' || !O || typeof O.hasOwn !== 'function' ||
      typeof O.fromEntries !== 'function' || typeof O.getOwnPropertyDescriptors !== 'function' ||
      !A || typeof A.prototype.flatMap !== 'function' || !N || typeof N.isSafeInteger !== 'function' ||
      typeof env.Map !== 'function' || typeof env.Set !== 'function') {
      return { supported: false, code: 'RUNTIME_CAPABILITY_MISSING' };
    }
    const value = env.BigInt('9007199254740993');
    if ((value + env.BigInt('2')).toString() !== '9007199254740995' ||
      (value / env.BigInt('3')).toString() !== '3002399751580331' ||
      env.JSON.stringify({ cents: value.toString() }) !== '{"cents":"9007199254740993"}') {
      return { supported: false, code: 'RUNTIME_ARITHMETIC_UNSUPPORTED' };
    }
    return { supported: true, code: 'CAPABILITIES_PRESENT_NOT_NATIVE_CERTIFICATION' };
  } catch { return { supported: false, code: 'RUNTIME_PROBE_FAILED' }; }
}
module.exports = { probeRuntime };
