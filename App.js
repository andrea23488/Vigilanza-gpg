import React, { useMemo, useState } from 'react';

import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';

const COLORS = {
  bg: '#07111F',
  card: '#101C2D',
  card2: '#112238',
  border: '#203550',
  white: '#FFFFFF',
  muted: '#91A3BA',
  blue: '#168BFF',
  lightBlue: '#55B8FF',
  green: '#50D89F',
  red: '#FF6B6B',
  orange: '#FFAE57',
};

const MESI = [
  'Gennaio',
  'Febbraio',
  'Marzo',
  'Aprile',
  'Maggio',
  'Giugno',
  'Luglio',
  'Agosto',
  'Settembre',
  'Ottobre',
  'Novembre',
  'Dicembre',
];

const PAY = {
  base: 1468.88,
  straordinario: 11.03783,
  piantonamentoDiurno: 0.65,
  compensativa: 1.86,
  piantonamentoNotturno: 4.18,
  riposoLavorato: 11.88689,
  coefficienteNetto: 1992 / 2577.16,
};

const DATI_INIZIALI = [
  {
    id: '1',
    giorno: 12,
    tipo: 'turno',
    inizio: '14:00',
    fine: '22:00',
    luogo: 'Fiumicino',
    ore: 8,
    extra: 1,
    fascia: 'Pomeriggio',
    riposoLavorato: false,
  },
  {
    id: '2',
    giorno: 13,
    tipo: 'turno',
    inizio: '22:00',
    fine: '06:00',
    luogo: 'Fiumicino',
    ore: 8,
    extra: 1,
    fascia: 'Notte',
    riposoLavorato: false,
  },
  {
    id: '3',
    giorno: 14,
    tipo: 'riposo',
  },
];

const COLLEGHI = [
  {
    id: '1',
    nome: 'Marco Rossi',
    iniziali: 'MR',
    servizio: true,
    turno: '14:00–22:00',
    sede: 'Fiumicino',
  },
  {
    id: '2',
    nome: 'Luca Bianchi',
    iniziali: 'LB',
    servizio: true,
    turno: '22:00–06:00',
    sede: 'Fiumicino',
  },
  {
    id: '3',
    nome: 'Fabio Conti',
    iniziali: 'FC',
    servizio: false,
    turno: 'Riposo',
    sede: '',
  },
];

export default function App() {
  const [screen, setScreen] = useState('home');
  const [mese, setMese] = useState(7);
  const [anno, setAnno] = useState(2026);
  const [records, setRecords] = useState(DATI_INIZIALI);

  const [editingId, setEditingId] = useState(null);
  const [giorno, setGiorno] = useState(1);
  const [tipo, setTipo] = useState('turno');
  const [inizio, setInizio] = useState('06:00');
  const [fine, setFine] = useState('14:00');
  const [luogo, setLuogo] = useState('Fiumicino');
  const [extra, setExtra] = useState('1');
  const [riposoLavorato, setRiposoLavorato] = useState(false);

  const [profilo, setProfilo] = useState({
    nome: 'Andrea',
    cognome: 'Ischiboni',
    azienda: 'Italpol',
    qualifica: 'Guardia Particolare Giurata',
    sede: 'Roma',
  });

  const turni = useMemo(
    () => records.filter((r) => r.tipo === 'turno'),
    [records]
  );

  const stipendio = useMemo(() => {
    let ore = 0;
    let extraOre = 0;
    let notturni = 0;
    let diurni = 0;
    let oreRiposo = 0;

    turni.forEach((t) => {
      ore += Number(t.ore || 0);
      extraOre += Number(t.extra || 0);

      if (t.fascia === 'Notte') notturni += 1;
      else diurni += 1;

      if (t.riposoLavorato) {
        oreRiposo += Number(t.ore || 0);
      }
    });

    const ordinarie = Math.max(0, ore - extraOre);

    const valoreExtra = extraOre * PAY.straordinario;
    const valoreDiurno = diurni * PAY.piantonamentoDiurno;
    const valoreComp = diurni * PAY.compensativa;
    const valoreNotte = notturni * PAY.piantonamentoNotturno;
    const valoreRiposo = oreRiposo * PAY.riposoLavorato;

    const maggiorazioni =
      valoreExtra +
      valoreDiurno +
      valoreComp +
      valoreNotte +
      valoreRiposo;

    const lordo = PAY.base + maggiorazioni;
    const netto = lordo * PAY.coefficienteNetto;

    return {
      ore,
      extraOre,
      ordinarie,
      notturni,
      diurni,
      oreRiposo,
      valoreExtra,
      valoreDiurno,
      valoreComp,
      valoreNotte,
      valoreRiposo,
      maggiorazioni,
      lordo,
      netto,
    };
  }, [turni]);

  function calcolaOre(start, end) {
    const [h1, m1] = start.split(':').map(Number);
    const [h2, m2] = end.split(':').map(Number);

    let a = h1 * 60 + m1;
    let b = h2 * 60 + m2;

    if (b <= a) b += 1440;

    return (b - a) / 60;
  }

  function fasciaTurno(orario) {
    const h = Number(orario.split(':')[0]);

    if (h >= 21 || h < 5) return 'Notte';
    if (h >= 5 && h < 13) return 'Mattina';

    return 'Pomeriggio';
  }

  function selezionaRapido(start, end) {
    setInizio(start);
    setFine(end);

    const ore = calcolaOre(start, end);
    setExtra(String(Math.max(0, ore - 7)));
  }

  function nuovoGiorno(g) {
    setEditingId(null);
    setGiorno(g);
    setTipo('turno');
    setInizio('06:00');
    setFine('14:00');
    setLuogo('Fiumicino');
    setExtra('1');
    setRiposoLavorato(false);
    setScreen('edit');
  }

  function modificaGiorno(record) {
    setEditingId(record.id);
    setGiorno(record.giorno);
    setTipo(record.tipo);
    setInizio(record.inizio || '06:00');
    setFine(record.fine || '14:00');
    setLuogo(record.luogo || '');
    setExtra(String(record.extra || 0));
    setRiposoLavorato(record.riposoLavorato || false);
    setScreen('edit');
  }

  function salvaGiorno() {
    let nuovo;

    if (tipo === 'turno') {
      const ore = calcolaOre(inizio, fine);
      const extraNumero = Number(String(extra).replace(',', '.'));

      nuovo = {
        id: editingId || Date.now().toString(),
        giorno,
        tipo: 'turno',
        inizio,
        fine,
        luogo: luogo || 'Servizio',
        ore,
        extra: Number.isNaN(extraNumero) ? 0 : extraNumero,
        fascia: fasciaTurno(inizio),
        riposoLavorato,
      };
    } else {
      nuovo = {
        id: editingId || Date.now().toString(),
        giorno,
        tipo,
      };
    }

    setRecords((precedenti) => {
      if (editingId) {
        return precedenti.map((r) => (r.id === editingId ? nuovo : r));
      }

      const stessoGiorno = precedenti.find((r) => r.giorno === giorno);

      if (stessoGiorno) {
        return precedenti.map((r) =>
          r.id === stessoGiorno.id
            ? { ...nuovo, id: stessoGiorno.id }
            : r
        );
      }

      return [...precedenti, nuovo];
    });

    setScreen('calendar');
  }

  function eliminaGiorno() {
    Alert.alert('Elimina giornata', 'Vuoi eliminare questa giornata?', [
      {
        text: 'Annulla',
      },
      {
        text: 'Elimina',
        style: 'destructive',
        onPress: () => {
          setRecords((prev) => prev.filter((r) => r.id !== editingId));
          setScreen('calendar');
        },
      },
    ]);
  }

  if (screen === 'turni') {
    return (
      <Screen>
        <Back onPress={() => setScreen('home')} />

        <Text style={styles.pageTitle}>I miei turni</Text>
        <Text style={styles.pageSubtitle}>
          {MESI[mese]} {anno}
        </Text>

        <TouchableOpacity
          style={styles.blueButton}
          onPress={() => setScreen('calendar')}
        >
          <Text style={styles.blueButtonText}>📅 APRI CALENDARIO</Text>
        </TouchableOpacity>

        {[...records]
          .sort((a, b) => a.giorno - b.giorno)
          .map((r) => (
            <TouchableOpacity
              key={r.id}
              style={styles.recordCard}
              onPress={() => modificaGiorno(r)}
            >
              <View style={styles.recordDate}>
                <Text style={styles.recordDay}>{r.giorno}</Text>
                <Text style={styles.recordMonth}>
                  {MESI[mese].slice(0, 3).toUpperCase()}
                </Text>
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.recordTitle}>
                  {r.tipo === 'turno'
                    ? `${r.inizio} — ${r.fine}`
                    : labelTipo(r.tipo)}
                </Text>

                <Text style={styles.recordSubtitle}>
                  {r.tipo === 'turno'
                    ? `${r.fascia} • ${r.luogo}`
                    : 'Giornata non lavorata'}
                </Text>
              </View>

              {r.tipo === 'turno' && (
                <Text style={styles.hoursBadge}>{r.ore}h</Text>
              )}
            </TouchableOpacity>
          ))}
      </Screen>
    );
  }

  if (screen === 'calendar') {
    return (
      <Screen>
        <Back onPress={() => setScreen('home')} />

        <Text style={styles.pageTitle}>Calendario</Text>
        <Text style={styles.pageSubtitle}>Tocca un giorno</Text>

        <View style={styles.monthSelector}>
          <TouchableOpacity
            onPress={() => {
              if (mese === 0) {
                setMese(11);
                setAnno(anno - 1);
              } else {
                setMese(mese - 1);
              }
            }}
          >
            <Text style={styles.monthArrow}>‹</Text>
          </TouchableOpacity>

          <View>
            <Text style={styles.monthTitle}>{MESI[mese]}</Text>
            <Text style={styles.monthYear}>{anno}</Text>
          </View>

          <TouchableOpacity
            onPress={() => {
              if (mese === 11) {
                setMese(0);
                setAnno(anno + 1);
              } else {
                setMese(mese + 1);
              }
            }}
          >
            <Text style={styles.monthArrow}>›</Text>
          </TouchableOpacity>
        </View>

        <Calendar
          anno={anno}
          mese={mese}
          records={records}
          onPress={(g, record) =>
            record ? modificaGiorno(record) : nuovoGiorno(g)
          }
        />

        <View style={styles.statsRow}>
          <MiniStat label="ORE" value={`${numero(stipendio.ore)} h`} />
          <MiniStat label="EXTRA" value={`${numero(stipendio.extraOre)} h`} />
          <MiniStat label="NOTTI" value={`${stipendio.notturni}`} />
        </View>
      </Screen>
    );
  }

  if (screen === 'edit') {
    return (
      <Screen>
        <Back onPress={() => setScreen('calendar')} />

        <Text style={styles.pageTitle}>
          {editingId ? 'Modifica giornata' : 'Nuova giornata'}
        </Text>

        <Text style={styles.pageSubtitle}>
          {giorno} {MESI[mese]} {anno}
        </Text>

        <Text style={styles.inputLabel}>TIPO GIORNATA</Text>

        <View style={styles.typeWrap}>
          {[
            ['turno', 'Turno'],
            ['riposo', 'Riposo'],
            ['ferie', 'Ferie'],
            ['malattia', 'Malattia'],
            ['permesso', 'Permesso'],
          ].map(([id, nome]) => (
            <TouchableOpacity
              key={id}
              style={[
                styles.typeButton,
                tipo === id && styles.typeButtonOn,
              ]}
              onPress={() => setTipo(id)}
            >
              <Text
                style={[
                  styles.typeText,
                  tipo === id && styles.typeTextOn,
                ]}
              >
                {nome}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {tipo === 'turno' && (
          <>
            <Text style={styles.inputLabel}>TURNO RAPIDO</Text>

            <View style={styles.quickRow}>
              <Quick
                text="06–14"
                onPress={() => selezionaRapido('06:00', '14:00')}
              />
              <Quick
                text="14–22"
                onPress={() => selezionaRapido('14:00', '22:00')}
              />
              <Quick
                text="22–06"
                onPress={() => selezionaRapido('22:00', '06:00')}
              />
            </View>

            <View style={styles.inputRow}>
              <View style={{ flex: 1 }}>
                <Input label="INIZIO" value={inizio} setValue={setInizio} />
              </View>

              <View style={{ width: 10 }} />

              <View style={{ flex: 1 }}>
                <Input label="FINE" value={fine} setValue={setFine} />
              </View>
            </View>

            <Input
              label="POSTAZIONE"
              value={luogo}
              setValue={setLuogo}
              placeholder="Es. Fiumicino"
            />

            <View style={styles.extraBox}>
              <View style={{ flex: 1 }}>
                <Text style={styles.extraTitle}>Ore straordinarie</Text>
                <Text style={styles.extraSub}>
                  Puoi modificarle manualmente
                </Text>
              </View>

              <TextInput
                style={styles.extraInput}
                value={extra}
                onChangeText={setExtra}
                keyboardType="decimal-pad"
              />
            </View>

            <TouchableOpacity
              style={[
                styles.restBox,
                riposoLavorato && styles.restBoxOn,
              ]}
              onPress={() => setRiposoLavorato(!riposoLavorato)}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.restTitle}>Riposo lavorato</Text>
                <Text style={styles.restSub}>
                  Attiva se lavori nel giorno di riposo
                </Text>
              </View>

              <Text style={styles.restCheck}>
                {riposoLavorato ? '✓' : '○'}
              </Text>
            </TouchableOpacity>
          </>
        )}

        <TouchableOpacity style={styles.blueButton} onPress={salvaGiorno}>
          <Text style={styles.blueButtonText}>SALVA GIORNATA</Text>
        </TouchableOpacity>

        {editingId && (
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={eliminaGiorno}
          >
            <Text style={styles.deleteText}>Elimina giornata</Text>
          </TouchableOpacity>
        )}
      </Screen>
    );
  }

  if (screen === 'stipendio') {
    return (
      <Screen>
        <Back onPress={() => setScreen('home')} />

        <Text style={styles.pageTitle}>Stipendio</Text>

        <Text style={styles.pageSubtitle}>
          {MESI[mese]} {anno}
        </Text>

        <View style={styles.netCard}>
          <Text style={styles.netLabel}>NETTO STIMATO</Text>
          <Text style={styles.netValue}>
            € {soldi(stipendio.netto)}
          </Text>
          <Text style={styles.netSub}>Stima indicativa del mese</Text>
        </View>

        <View style={styles.salaryCard}>
          <Text style={styles.smallBlue}>LORDO STIMATO</Text>
          <Text style={styles.salary}>
            € {soldi(stipendio.lordo)}
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Dettaglio</Text>

        <SalaryRow
          label="Ore lavorate"
          value={`${numero(stipendio.ore)} h`}
        />

        <SalaryRow
          label="Straordinari"
          value={`${numero(stipendio.extraOre)} h`}
          euro={stipendio.valoreExtra}
        />

        <SalaryRow
          label="Piantonamento notturno"
          value={`${stipendio.notturni} turni`}
          euro={stipendio.valoreNotte}
        />

        <SalaryRow
          label="Riposo lavorato"
          value={`${numero(stipendio.oreRiposo)} h`}
          euro={stipendio.valoreRiposo}
        />

        <View style={styles.totalBox}>
          <Text style={styles.totalLabel}>MAGGIORAZIONI</Text>
          <Text style={styles.totalValue}>
            + € {soldi(stipendio.maggiorazioni)}
          </Text>
        </View>
      </Screen>
    );
  }

  if (screen === 'colleghi') {
    return (
      <Screen>
        <Back onPress={() => setScreen('home')} />

        <Text style={styles.pageTitle}>Colleghi</Text>
        <Text style={styles.pageSubtitle}>Italpol • modalità demo</Text>

        {COLLEGHI.map((c) => (
          <View key={c.id} style={styles.colleagueCard}>
            <View style={styles.colleagueAvatar}>
              <Text style={styles.colleagueAvatarText}>
                {c.iniziali}
              </Text>
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.colleagueName}>{c.nome}</Text>

              <Text
                style={
                  c.servizio
                    ? styles.serviceOn
                    : styles.serviceOff
                }
              >
                {c.servizio
                  ? `${c.turno} • ${c.sede}`
                  : 'Fuori servizio'}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.swapButton}
              onPress={() =>
                Alert.alert(
                  'Scambio turno',
                  `Richiesta demo inviata a ${c.nome}`
                )
              }
            >
              <Text style={styles.swapText}>⇄</Text>
            </TouchableOpacity>
          </View>
        ))}
      </Screen>
    );
  }

  if (screen === 'profile') {
    return (
      <Screen>
        <Back onPress={() => setScreen('home')} />

        <Text style={styles.pageTitle}>Profilo</Text>
        <Text style={styles.pageSubtitle}>Identità professionale</Text>

        <View style={styles.profileHero}>
          <View style={styles.profileAvatar}>
            <Text style={styles.profileAvatarText}>AI</Text>
          </View>

          <Text style={styles.profileName}>
            {profilo.nome} {profilo.cognome}
          </Text>

          <Text style={styles.profileRole}>
            {profilo.qualifica}
          </Text>

          <Text style={styles.profileCompany}>
            {profilo.azienda}
          </Text>
        </View>

        <Info label="Azienda" value={profilo.azienda} />
        <Info label="Qualifica" value={profilo.qualifica} />
        <Info label="Sede" value={profilo.sede} />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <TouchableOpacity
          style={{ flex: 1 }}
          onPress={() => setScreen('profile')}
        >
          <Text style={styles.welcome}>
            Buon servizio, {profilo.nome} 👋
          </Text>

          <Text style={styles.company}>
            {profilo.azienda} • {profilo.qualifica}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.avatar}
          onPress={() => setScreen('profile')}
        >
          <Text style={styles.avatarText}>AI</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.hero}>
        <Text style={styles.smallBlue}>QUESTO MESE</Text>

        <Text style={styles.heroMonth}>
          {MESI[mese]} {anno}
        </Text>

        <View style={styles.heroStats}>
          <HomeStat
            value={`${numero(stipendio.ore)}h`}
            label="Ore"
          />

          <HomeStat
            value={`${numero(stipendio.extraOre)}h`}
            label="Extra"
          />

          <HomeStat
            value={`€${Math.round(stipendio.netto)}`}
            label="Netto"
          />
        </View>
      </View>

      <Text style={styles.sectionTitle}>Il tuo servizio</Text>

      <Menu
        icon="📅"
        title="I miei turni"
        subtitle="Elenco servizi e riposi"
        onPress={() => setScreen('turni')}
      />

      <Menu
        icon="🗓️"
        title="Calendario"
        subtitle="Inserisci e modifica le giornate"
        onPress={() => setScreen('calendar')}
      />

      <Menu
        icon="💶"
        title="Stipendio"
        subtitle="Stima e maggiorazioni"
        onPress={() => setScreen('stipendio')}
      />

      <Menu
        icon="👥"
        title="Colleghi"
        subtitle="Chi è in servizio"
        onPress={() => setScreen('colleghi')}
      />

      <Menu
        icon="👮🏻‍♂️"
        title="Profilo"
        subtitle="Azienda e qualifica"
        onPress={() => setScreen('profile')}
      />

      <TouchableOpacity
        style={styles.blueButton}
        onPress={() => setScreen('calendar')}
      >
        <Text style={styles.blueButtonText}>
          ＋ INSERISCI GIORNATA
        </Text>
      </TouchableOpacity>

      <Text style={styles.footer}>
        VIGILANZA GPG • PROTOTIPO
      </Text>
    </Screen>
  );
}

function Calendar({ anno, mese, records, onPress }) {
  const giorni = new Date(anno, mese + 1, 0).getDate();

  let primo = new Date(anno, mese, 1).getDay();
  primo = primo === 0 ? 6 : primo - 1;

  const celle = [];

  for (let i = 0; i < primo; i++) celle.push(null);
  for (let g = 1; g <= giorni; g++) celle.push(g);

  function trova(g) {
    return records.find((r) => r.giorno === g);
  }

  function codice(r) {
    if (!r) return '';

    if (r.tipo === 'riposo') return 'RIP';
    if (r.tipo === 'ferie') return 'FER';
    if (r.tipo === 'malattia') return 'MAL';
    if (r.tipo === 'permesso') return 'PER';

    return `${r.inizio.slice(0, 2)}-${r.fine.slice(0, 2)}`;
  }

  return (
    <View style={styles.calendar}>
      <View style={styles.weekRow}>
        {['L', 'M', 'M', 'G', 'V', 'S', 'D'].map((d, i) => (
          <Text key={i} style={styles.weekDay}>
            {d}
          </Text>
        ))}
      </View>

      <View style={styles.calendarGrid}>
        {celle.map((g, i) => {
          if (!g) {
            return <View key={i} style={styles.day} />;
          }

          const r = trova(g);

          return (
            <TouchableOpacity
              key={i}
              style={[styles.day, r && styles.dayActive]}
              onPress={() => onPress(g, r)}
            >
              <Text
                style={[
                  styles.dayNumber,
                  r && styles.dayNumberActive,
                ]}
              >
                {g}
              </Text>

              {r && (
                <Text style={styles.dayCode}>
                  {codice(r)}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function Screen({ children }) {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

function Back({ onPress }) {
  return (
    <TouchableOpacity style={styles.backButton} onPress={onPress}>
      <Text style={styles.backText}>‹</Text>
    </TouchableOpacity>
  );
}

function Menu({ icon, title, subtitle, onPress }) {
  return (
    <TouchableOpacity style={styles.menuCard} onPress={onPress}>
      <Text style={styles.menuIcon}>{icon}</Text>

      <View style={{ flex: 1 }}>
        <Text style={styles.menuTitle}>{title}</Text>
        <Text style={styles.menuSubtitle}>{subtitle}</Text>
      </View>

      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );
}

function Quick({ text, onPress }) {
  return (
    <TouchableOpacity style={styles.quickButton} onPress={onPress}>
      <Text style={styles.quickText}>{text}</Text>
    </TouchableOpacity>
  );
}

function Input({ label, value, setValue, placeholder }) {
  return (
    <View style={styles.inputWrap}>
      <Text style={styles.inputLabel}>{label}</Text>

      <TextInput
        style={styles.input}
        value={value}
        onChangeText={setValue}
        placeholder={placeholder}
        placeholderTextColor="#667A91"
      />
    </View>
  );
}

function MiniStat({ label, value }) {
  return (
    <View style={styles.miniStat}>
      <Text style={styles.miniValue}>{value}</Text>
      <Text style={styles.miniLabel}>{label}</Text>
    </View>
  );
}

function HomeStat({ label, value }) {
  return (
    <View>
      <Text style={styles.homeStatValue}>{value}</Text>
      <Text style={styles.homeStatLabel}>{label}</Text>
    </View>
  );
}

function SalaryRow({ label, value, euro }) {
  return (
    <View style={styles.salaryRow}>
      <Text style={styles.salaryRowLabel}>{label}</Text>

      <View style={{ alignItems: 'flex-end' }}>
        <Text style={styles.salaryRowValue}>{value}</Text>

        {typeof euro === 'number' && (
          <Text style={styles.salaryEuro}>
            € {soldi(euro)}
          </Text>
        )}
      </View>
    </View>
  );
}

function Info({ label, value }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function labelTipo(tipo) {
  if (tipo === 'riposo') return 'Riposo';
  if (tipo === 'ferie') return 'Ferie';
  if (tipo === 'malattia') return 'Malattia';
  if (tipo === 'permesso') return 'Permesso';

  return 'Turno';
}

function soldi(n) {
  return Number(n || 0).toFixed(2).replace('.', ',');
}

function numero(n) {
  const value = Number(n || 0);

  if (Number.isInteger(value)) return String(value);

  return value.toFixed(1).replace('.', ',');
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },

  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },

  content: {
    padding: 20,
    paddingTop: 20,
    paddingBottom: 60,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 25,
  },

  welcome: {
    color: COLORS.white,
    fontSize: 23,
    fontWeight: '900',
  },

  company: {
    color: COLORS.muted,
    fontSize: 12,
    marginTop: 5,
  },

  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.blue,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },

  avatarText: {
    color: COLORS.white,
    fontWeight: '900',
  },

  hero: {
    backgroundColor: '#10304B',
    borderRadius: 24,
    padding: 22,
    marginBottom: 27,
  },

  smallBlue: {
    color: COLORS.lightBlue,
    fontWeight: '900',
    fontSize: 11,
    letterSpacing: 1,
  },

  heroMonth: {
    color: COLORS.white,
    fontSize: 28,
    fontWeight: '900',
    marginTop: 6,
  },

  heroStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 22,
  },

  homeStatValue: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: '900',
  },

  homeStatLabel: {
    color: COLORS.muted,
    fontSize: 11,
    marginTop: 3,
  },

  sectionTitle: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 14,
  },

  menuCard: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 11,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  menuIcon: {
    fontSize: 24,
    marginRight: 14,
  },

  menuTitle: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '900',
  },

  menuSubtitle: {
    color: COLORS.muted,
    fontSize: 12,
    marginTop: 4,
  },

  chevron: {
    color: COLORS.muted,
    fontSize: 30,
  },

  blueButton: {
    backgroundColor: COLORS.blue,
    borderRadius: 17,
    padding: 17,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 12,
  },

  blueButtonText: {
    color: COLORS.white,
    fontWeight: '900',
  },

  footer: {
    color: '#586D85',
    textAlign: 'center',
    marginTop: 25,
    fontSize: 11,
  },

  backButton: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },

  backText: {
    color: COLORS.white,
    fontSize: 34,
  },

  pageTitle: {
    color: COLORS.white,
    fontSize: 29,
    fontWeight: '900',
  },

  pageSubtitle: {
    color: COLORS.muted,
    marginTop: 5,
    marginBottom: 22,
  },

  recordCard: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },

  recordDate: {
    width: 54,
    height: 54,
    borderRadius: 15,
    backgroundColor: '#193653',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },

  recordDay: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: '900',
  },

  recordMonth: {
    color: COLORS.lightBlue,
    fontSize: 9,
    fontWeight: '900',
  },

  recordTitle: {
    color: COLORS.white,
    fontWeight: '900',
    fontSize: 16,
  },

  recordSubtitle: {
    color: COLORS.muted,
    fontSize: 11,
    marginTop: 4,
  },

  hoursBadge: {
    color: COLORS.white,
    backgroundColor: '#173F61',
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 7,
    fontWeight: '900',
  },

  monthSelector: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    marginBottom: 14,
  },

  monthArrow: {
    color: COLORS.white,
    fontSize: 35,
    paddingHorizontal: 15,
  },

  monthTitle: {
    color: COLORS.white,
    fontSize: 21,
    fontWeight: '900',
    textAlign: 'center',
  },

  monthYear: {
    color: COLORS.muted,
    textAlign: 'center',
    marginTop: 2,
  },

  calendar: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 10,
  },

  weekRow: {
    flexDirection: 'row',
  },

  weekDay: {
    width: '14.285%',
    textAlign: 'center',
    color: COLORS.muted,
    fontWeight: '900',
    paddingVertical: 8,
  },

  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },

  day: {
    width: '14.285%',
    height: 62,
    alignItems: 'center',
    justifyContent: 'center',
  },

  dayActive: {
    backgroundColor: '#173C5D',
    borderRadius: 12,
  },

  dayNumber: {
    color: COLORS.muted,
  },

  dayNumberActive: {
    color: COLORS.white,
    fontWeight: '900',
  },

  dayCode: {
    color: COLORS.lightBlue,
    fontSize: 9,
    fontWeight: '900',
    marginTop: 4,
  },

  statsRow: {
    flexDirection: 'row',
    marginTop: 14,
  },

  miniStat: {
    flex: 1,
    backgroundColor: '#102239',
    borderRadius: 15,
    padding: 13,
    alignItems: 'center',
    marginHorizontal: 4,
  },

  miniValue: {
    color: COLORS.white,
    fontWeight: '900',
    fontSize: 18,
  },

  miniLabel: {
    color: COLORS.muted,
    fontSize: 9,
    marginTop: 3,
  },

  inputLabel: {
    color: '#7F93AB',
    fontWeight: '900',
    fontSize: 11,
    marginBottom: 8,
  },

  typeWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 22,
  },

  typeButton: {
    backgroundColor: '#15283F',
    borderRadius: 13,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginRight: 7,
    marginBottom: 8,
  },

  typeButtonOn: {
    backgroundColor: COLORS.blue,
  },

  typeText: {
    color: COLORS.muted,
    fontWeight: '800',
  },

  typeTextOn: {
    color: COLORS.white,
  },

  quickRow: {
    flexDirection: 'row',
    marginBottom: 18,
  },

  quickButton: {
    flex: 1,
    backgroundColor: '#19334F',
    borderRadius: 14,
    padding: 13,
    alignItems: 'center',
    marginHorizontal: 4,
  },

  quickText: {
    color: COLORS.white,
    fontWeight: '900',
  },

  inputRow: {
    flexDirection: 'row',
  },

  inputWrap: {
    marginBottom: 18,
  },

  input: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    color: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  extraBox: {
    backgroundColor: '#102A43',
    borderRadius: 17,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 17,
  },

  extraTitle: {
    color: COLORS.white,
    fontWeight: '900',
  },

  extraSub: {
    color: COLORS.muted,
    fontSize: 11,
    marginTop: 4,
  },

  extraInput: {
    width: 60,
    height: 48,
    backgroundColor: COLORS.bg,
    borderRadius: 13,
    textAlign: 'center',
    color: COLORS.white,
    fontSize: 20,
    fontWeight: '900',
  },

  restBox: {
    backgroundColor: COLORS.card,
    borderRadius: 17,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 17,
  },

  restBoxOn: {
    backgroundColor: '#2A251D',
  },

  restTitle: {
    color: COLORS.white,
    fontWeight: '900',
  },

  restSub: {
    color: COLORS.muted,
    fontSize: 11,
    marginTop: 4,
  },

  restCheck: {
    color: COLORS.orange,
    fontSize: 26,
  },

  deleteButton: {
    padding: 16,
    alignItems: 'center',
  },

  deleteText: {
    color: COLORS.red,
  },

  netCard: {
    backgroundColor: '#0F5A49',
    borderRadius: 24,
    padding: 22,
    marginBottom: 14,
  },

  netLabel: {
    color: '#8EF0D0',
    fontWeight: '900',
    fontSize: 11,
  },

  netValue: {
    color: COLORS.white,
    fontSize: 38,
    fontWeight: '900',
    marginTop: 5,
  },

  netSub: {
    color: '#B7D9CF',
    marginTop: 5,
    fontSize: 11,
  },

  salaryCard: {
    backgroundColor: '#123653',
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
  },

  salary: {
    color: COLORS.white,
    fontSize: 32,
    fontWeight: '900',
    marginTop: 7,
  },

  salaryRow: {
    backgroundColor: COLORS.card,
    borderRadius: 15,
    padding: 15,
    marginBottom: 9,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  salaryRowLabel: {
    color: COLORS.white,
    fontWeight: '800',
  },

  salaryRowValue: {
    color: COLORS.white,
    fontWeight: '900',
  },

  salaryEuro: {
    color: COLORS.green,
    fontSize: 11,
    marginTop: 3,
  },

  totalBox: {
    backgroundColor: '#112C45',
    borderRadius: 18,
    padding: 18,
    marginTop: 7,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  totalLabel: {
    color: COLORS.lightBlue,
    fontWeight: '900',
  },

  totalValue: {
    color: COLORS.white,
    fontWeight: '900',
  },

  colleagueCard: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },

  colleagueAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#193653',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 13,
  },

  colleagueAvatarText: {
    color: COLORS.white,
    fontWeight: '900',
  },

  colleagueName: {
    color: COLORS.white,
    fontWeight: '900',
    fontSize: 16,
  },

  serviceOn: {
    color: COLORS.green,
    fontSize: 11,
    marginTop: 4,
  },

  serviceOff: {
    color: COLORS.muted,
    fontSize: 11,
    marginTop: 4,
  },

  swapButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#173F61',
    alignItems: 'center',
    justifyContent: 'center',
  },

  swapText: {
    color: COLORS.lightBlue,
    fontSize: 24,
    fontWeight: '900',
  },

  profileHero: {
    backgroundColor: '#10304B',
    borderRadius: 24,
    padding: 25,
    alignItems: 'center',
    marginBottom: 16,
  },

  profileAvatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: COLORS.blue,
    justifyContent: 'center',
    alignItems: 'center',
  },

  profileAvatarText: {
    color: COLORS.white,
    fontSize: 30,
    fontWeight: '900',
  },

  profileName: {
    color: COLORS.white,
    fontSize: 24,
    fontWeight: '900',
    marginTop: 14,
  },

  profileRole: {
    color: COLORS.muted,
    marginTop: 5,
    textAlign: 'center',
  },

  profileCompany: {
    color: COLORS.lightBlue,
    backgroundColor: '#173F61',
    borderRadius: 13,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginTop: 13,
    fontWeight: '900',
  },

  infoRow: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 9,
  },

  infoLabel: {
    color: COLORS.muted,
  },

  infoValue: {
    color: COLORS.white,
    fontWeight: '900',
    flexShrink: 1,
    textAlign: 'right',
  },
});