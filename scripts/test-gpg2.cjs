process.env.TZ = 'UTC';
const path = require('node:path');
const files = [
 'experimental/gpg-v2/core/classificaOre.test.cjs',
 'experimental/gpg-v2/core/calcolaEconomia.test.cjs',
 'experimental/gpg-v2/tests/recovered/confrontaMotori.test.cjs',
 'experimental/gpg-v2/tests/recovered/diagnosticaCedolino.test.cjs',
 'experimental/gpg-v2/core/adattatoreCalendario.test.cjs',
 'experimental/gpg-v2/core/profiliGpg.test.cjs',
 'experimental/gpg-v2/tests/fiscalita.test.cjs',
 'scripts/test-gpg2-integration.cjs',
];
// Un solo processo: nessun risultato dedotto dall'uscita di processi figli.
for (const file of files) require(path.resolve(file));
