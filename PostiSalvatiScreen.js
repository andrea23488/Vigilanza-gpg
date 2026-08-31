import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

const CHIAVE_BASE = 'vigilanza_scheda_posto_';

const nomeDaChiave = (chiave = '') =>
  String(chiave)
    .replace(CHIAVE_BASE, '')
    .split('_')
    .filter(Boolean)
    .map(parola => parola.toUpperCase() === 'ita'
      ? 'ITA'
      : parola.charAt(0).toUpperCase() + parola.slice(1)
    )
    .join(' ');

export default function PostiSalvatiScreen({
  onBack,
  onApriPosto,
}) {
  const [posti, setPosti] = useState([]);
  const [ricerca, setRicerca] = useState('');
  const [caricamento, setCaricamento] = useState(true);

  const caricaPosti = useCallback(async () => {
    try {
      setCaricamento(true);

      const chiavi = await AsyncStorage.getAllKeys();
      const chiaviPosti = chiavi.filter(k =>
        k.startsWith(CHIAVE_BASE)
      );

      const elementi = [];

      for (const chiave of chiaviPosti) {
        try {
          const raw = await AsyncStorage.getItem(chiave);
          if (!raw) continue;

          const dati = JSON.parse(raw);

          const nome =
            String(dati?.nomeLuogo || '').trim() ||
            nomeDaChiave(chiave);

          const media = Array.isArray(dati?.media)
            ? dati.media
            : [];

          elementi.push({
            chiave,
            nome,
            aggiornatoIl: dati?.aggiornatoIl || null,
            foto: media.filter(x => x?.tipo === 'foto').length,
            video: media.filter(x => x?.tipo === 'video').length,
            segnalazioni: String(
              dati?.segnalazioni || ''
            ).trim(),
          });
        } catch (e) {
          console.log(
            'Errore lettura posto:',
            chiave,
            e
          );
        }
      }

      // Elimina eventuali doppioni lasciati dalla vecchia versione
      const mappa = new Map();

      elementi.forEach(item => {
        const firma = item.nome
          .toLowerCase()
          .split(/\s+/)
          .filter(Boolean)
          .sort()
          .join('_');

        const precedente = mappa.get(firma);

        if (!precedente) {
          mappa.set(firma, item);
          return;
        }

        const dataNuova =
          new Date(item.aggiornatoIl || 0).getTime();

        const dataVecchia =
          new Date(precedente.aggiornatoIl || 0).getTime();

        if (dataNuova >= dataVecchia) {
          mappa.set(firma, item);
        }
      });

      setPosti(
        Array.from(mappa.values()).sort((a, b) => {
          const da = new Date(a.aggiornatoIl || 0).getTime();
          const db = new Date(b.aggiornatoIl || 0).getTime();
          return db - da;
        })
      );
    } catch (e) {
      console.log('Errore Posti salvati:', e);
      setPosti([]);
    } finally {
      setCaricamento(false);
    }
  }, []);

  React.useEffect(() => {
    caricaPosti();
  }, [caricaPosti]);

  const filtrati = posti.filter(p =>
    p.nome.toLowerCase().includes(
      ricerca.trim().toLowerCase()
    )
  );

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#07111F',
      }}
    >
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 18,
          paddingTop: 58,
          paddingBottom: 60,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 22,
          }}
        >
          <TouchableOpacity
            onPress={onBack}
            style={{
              width: 42,
              height: 42,
              borderRadius: 21,
              backgroundColor: '#101B34',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 13,
            }}
          >
            <Ionicons
              name="chevron-back"
              size={25}
              color="#FFFFFF"
            />
          </TouchableOpacity>

          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: '#8DB8FF',
                fontSize: 12,
                fontWeight: '900',
                letterSpacing: 1.2,
              }}
            >
              ARCHIVIO SERVIZI
            </Text>

            <Text
              style={{
                color: '#FFFFFF',
                fontSize: 25,
                fontWeight: '900',
                marginTop: 3,
              }}
            >
              Posti salvati
            </Text>
          </View>

          <View
            style={{
              width: 45,
              height: 45,
              borderRadius: 15,
              backgroundColor: 'rgba(49,88,168,0.25)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons
              name="location"
              size={25}
              color="#8DB8FF"
            />
          </View>
        </View>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#101B34',
            borderWidth: 1,
            borderColor: 'rgba(130,160,255,0.20)',
            borderRadius: 16,
            paddingHorizontal: 14,
            marginBottom: 22,
          }}
        >
          <Ionicons
            name="search-outline"
            size={20}
            color="#8190AD"
          />

          <TextInput
            value={ricerca}
            onChangeText={setRicerca}
            placeholder="Cerca un posto..."
            placeholderTextColor="#667590"
            style={{
              flex: 1,
              color: '#FFFFFF',
              fontSize: 15,
              paddingVertical: 14,
              marginLeft: 9,
            }}
          />
        </View>

        {!caricamento && posti.length > 0 && (
          <Text
            style={{
              color: '#8997B5',
              fontSize: 13,
              marginBottom: 12,
            }}
          >
            {posti.length}{' '}
            {posti.length === 1
              ? 'posto censito'
              : 'posti censiti'}
          </Text>
        )}

        {caricamento ? (
          <View
            style={{
              paddingVertical: 45,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: '#8997B5' }}>
              Caricamento...
            </Text>
          </View>
        ) : filtrati.length === 0 ? (
          <View
            style={{
              backgroundColor: '#101B34',
              borderRadius: 20,
              borderWidth: 1,
              borderColor: 'rgba(130,160,255,0.18)',
              paddingVertical: 38,
              paddingHorizontal: 20,
              alignItems: 'center',
            }}
          >
            <Ionicons
              name="location-outline"
              size={38}
              color="#62718F"
            />

            <Text
              style={{
                color: '#FFFFFF',
                fontWeight: '900',
                fontSize: 17,
                marginTop: 12,
              }}
            >
              Nessun posto trovato
            </Text>

            <Text
              style={{
                color: '#8997B5',
                fontSize: 13,
                textAlign: 'center',
                lineHeight: 19,
                marginTop: 7,
              }}
            >
              Le Schede Posto che compilerai compariranno qui.
            </Text>
          </View>
        ) : (
          filtrati.map(posto => (
            <TouchableOpacity
              key={posto.chiave}
              activeOpacity={0.82}
              onPress={() => onApriPosto(posto.nome)}
              style={{
                backgroundColor: '#101B34',
                borderRadius: 20,
                borderWidth: 1,
                borderColor: 'rgba(130,160,255,0.20)',
                padding: 16,
                marginBottom: 12,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                }}
              >
                <View
                  style={{
                    width: 45,
                    height: 45,
                    borderRadius: 14,
                    backgroundColor: 'rgba(49,88,168,0.25)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12,
                  }}
                >
                  <Ionicons
                    name="business-outline"
                    size={23}
                    color="#8DB8FF"
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: '#FFFFFF',
                      fontSize: 17,
                      fontWeight: '900',
                    }}
                  >
                    {posto.nome}
                  </Text>

                  <View
                    style={{
                      flexDirection: 'row',
                      flexWrap: 'wrap',
                      marginTop: 6,
                    }}
                  >
                    <Text
                      style={{
                        color: '#9AA8C5',
                        fontSize: 12,
                        marginRight: 12,
                      }}
                    >
                      📷 {posto.foto}
                    </Text>

                    <Text
                      style={{
                        color: '#9AA8C5',
                        fontSize: 12,
                      }}
                    >
                      🎥 {posto.video}
                    </Text>
                  </View>
                </View>

                <Ionicons
                  name="chevron-forward"
                  size={22}
                  color="#667590"
                />
              </View>

              {!!posto.segnalazioni && (
                <View
                  style={{
                    marginTop: 13,
                    paddingTop: 12,
                    borderTopWidth: 1,
                    borderTopColor: 'rgba(255,255,255,0.06)',
                    flexDirection: 'row',
                    alignItems: 'center',
                  }}
                >
                  <Ionicons
                    name="warning-outline"
                    size={16}
                    color="#FFAE57"
                  />

                  <Text
                    numberOfLines={1}
                    style={{
                      flex: 1,
                      color: '#D2D9E8',
                      fontSize: 12,
                      marginLeft: 7,
                    }}
                  >
                    {posto.segnalazioni}
                  </Text>
                </View>
              )}

              {!!posto.aggiornatoIl && (
                <Text
                  style={{
                    color: '#5F6D87',
                    fontSize: 10,
                    marginTop: 10,
                  }}
                >
                  Aggiornato il{' '}
                  {new Date(
                    posto.aggiornatoIl
                  ).toLocaleString('it-IT')}
                </Text>
              )}
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}
