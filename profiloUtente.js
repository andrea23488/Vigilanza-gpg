const testoProfilo = (valore) =>
  typeof valore === 'string' ? valore.trim() : '';

export function creaProfiloVuoto() {
  return {
    nome: '',
    cognome: '',
    azienda: '',
    ruolo: '',
    sede: '',
    punto_partenza: '',
    in_servizio_dal: null,
    codice_gpg: '',
    foto_url: null,
  };
}

export function costruisciProfiloUtente(profiloCloud, metadata = {}) {
  const cloud = profiloCloud || {};

  return {
    nome: testoProfilo(cloud.nome) || testoProfilo(metadata.nome),
    cognome:
      testoProfilo(cloud.cognome) || testoProfilo(metadata.cognome),
    azienda:
      testoProfilo(cloud.azienda) || testoProfilo(metadata.azienda),
    ruolo: testoProfilo(cloud.ruolo) || testoProfilo(metadata.ruolo),
    sede: testoProfilo(cloud.sede) || testoProfilo(metadata.sede),
    punto_partenza:
      testoProfilo(cloud.punto_partenza) ||
      testoProfilo(metadata.punto_partenza),
    in_servizio_dal:
      cloud.in_servizio_dal ?? metadata.in_servizio_dal ?? null,
    codice_gpg:
      testoProfilo(cloud.codice_gpg) ||
      testoProfilo(metadata.matricola) ||
      testoProfilo(metadata.codice_gpg),
    foto_url: testoProfilo(cloud.foto_url) || null,
  };
}
