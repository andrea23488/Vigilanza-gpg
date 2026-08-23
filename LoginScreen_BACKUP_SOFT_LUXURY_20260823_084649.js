import React, { useState } from 'react';

import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';

import { supabase } from './supabase';

const COLORS = {
  bg: '#07111F',
  card: '#101C2D',
  border: '#203550',
  white: '#FFFFFF',
  muted: '#91A3BA',
  blue: '#168BFF',
  lightBlue: '#55B8FF',
  green: '#50D89F',
};

export default function LoginScreen({ onEnterTest }) {
  const [mode, setMode] = useState('login');

  const [email, setEmail] = useState('');
  const [matricola, setMatricola] = useState('');
  const [password, setPassword] = useState('');
  const [nome, setNome] = useState('');
  const [cognome, setCognome] = useState('');

  const [loading, setLoading] = useState(false);

  async function continua() {
    if (!email.trim() || !password.trim()) {
      Alert.alert(
        'Dati mancanti',
        'Inserisci email e password.'
      );
      return;
    }

    if (password.length < 6) {
      Alert.alert(
        'Password troppo corta',
        'Inserisci una password di almeno 6 caratteri.'
      );
      return;
    }

    if (
      mode === 'register' &&
      (!nome.trim() || !cognome.trim())
    ) {
      Alert.alert(
        'Dati mancanti',
        'Inserisci nome e cognome.'
      );
      return;
    }

    if (mode === 'register') {
      await registrati();
    } else {
      await accedi();
    }
  }

  async function registrati() {
    try {
      setLoading(true);

      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: {
            nome: nome.trim(),
            cognome: cognome.trim(),
          matricola: matricola.trim() || null,
          },
        },
      });

      if (error) {
        throw error;
      }

      if (data.session) {
        Alert.alert(
          'Account creato ✅',
          'Registrazione completata. Il tuo account è già attivo.',
          [
            {
              text: 'OK',
              onPress: onEnterTest,
            },
          ]
        );
      } else {
        Alert.alert(
          'Account creato ✅',
          'Controlla la tua email e conferma la registrazione. Dopo potrai accedere.',
          [
            {
              text: 'OK',
              onPress: () => setMode('login'),
            },
          ]
        );
      }
    } catch (error) {
      console.log('ERRORE REGISTRAZIONE:', error);

      Alert.alert(
        'Registrazione non riuscita',
        error.message || 'Si è verificato un errore.'
      );
    } finally {
      setLoading(false);
    }
  }

  async function accedi() {
    try {
      setLoading(true);

      const { data, error } =
        await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });

      if (error) {
        throw error;
      }

      if (!data.session) {
        throw new Error(
          'Accesso non completato. Controlla di aver confermato la tua email.'
        );
      }

      Alert.alert(
        'Accesso riuscito ✅',
        'Bentornato in Vigilanza GPG.',
        [
          {
            text: 'ENTRA',
            onPress: onEnterTest,
          },
        ]
      );
    } catch (error) {
      console.log('ERRORE LOGIN:', error);

      Alert.alert(
        'Accesso non riuscito',
        error.message || 'Email o password non valide.'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.logoWrap}>
          <View style={styles.logoCircle}>
            <Image
          source={require('./assets/icon.png')}
          resizeMode="contain"
          style={{
            width: 82,
            height: 82,
            borderRadius: 20,
          }}
        />
          </View>

          <Text style={styles.appName}>
            VIGILANZA GPG E FIDUCIARI
          </Text>

          <Text style={styles.tagline}>
            Turni, colleghi e servizio sempre sotto controllo
          </Text>
        </View>

        <View style={styles.authCard}>
          <View style={styles.modeRow}>
            <TouchableOpacity
              style={[
                styles.modeButton,
                mode === 'login' && styles.modeButtonActive,
              ]}
              onPress={() => setMode('login')}
              disabled={loading}
            >
              <Text
                style={[
                  styles.modeText,
                  mode === 'login' && styles.modeTextActive,
                ]}
              >
                Accedi
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.modeButton,
                mode === 'register' && styles.modeButtonActive,
              ]}
              onPress={() => setMode('register')}
              disabled={loading}
            >
              <Text
                style={[
                  styles.modeText,
                  mode === 'register' && styles.modeTextActive,
                ]}
              >
                Registrati
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.title}>
            {mode === 'login'
              ? 'Bentornato'
              : 'Crea il tuo account'}
          </Text>

          <Text style={styles.subtitle}>
            {mode === 'login'
              ? 'Accedi per entrare nel tuo spazio personale.'
              : 'Registrati per creare il tuo profilo Vigilanza GPG.'}
          </Text>

          {mode === 'register' && (
            <>
              <Field
                label="NOME"
                value={nome}
                onChange={setNome}
                placeholder="Andrea"
              />

              <Field
                label="COGNOME"
                value={cognome}
                onChange={setCognome}
                placeholder="Rossi"
              />
            </>
          )}

        {mode === "register" && (
          <Field
            label="NUMERO DI MATRICOLA (FACOLTATIVO)"
            value={matricola}
            onChange={setMatricola}
            placeholder="Es. 123456"
          />
        )}

          <Field
            label="EMAIL"
            value={email}
            onChange={setEmail}
            placeholder="nome@email.it"
            keyboardType="email-address"
          />

          <Field
            label="PASSWORD"
            value={password}
            onChange={setPassword}
            placeholder="Almeno 6 caratteri"
            secureTextEntry
          />

          <TouchableOpacity
            style={[
              styles.primaryButton,
              loading && styles.disabled,
            ]}
            onPress={continua}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>
                {mode === 'login'
                  ? 'ACCEDI'
                  : 'CREA ACCOUNT'}
              </Text>
            )}
          </TouchableOpacity>

          {mode === 'login' && (
            <TouchableOpacity
              style={styles.forgotButton}
              onPress={() =>
                Alert.alert(
                  'Password dimenticata',
                  'La funzione di recupero password sarà il prossimo passaggio.'
                )
              }
            >
              <Text style={styles.forgotText}>
                Password dimenticata?
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.testBox}>
          <Text style={styles.testTitle}>
            Modalità sviluppo
          </Text>

          <Text style={styles.testText}>
            Durante lo sviluppo puoi ancora entrare nell’app senza account.
          </Text>

          <TouchableOpacity
            style={styles.testButton}
            onPress={onEnterTest}
          >
            <Text style={styles.testButtonText}>
              ENTRA IN MODALITÀ TEST
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.footer}>
          VIGILANZA GPG • VERSIONE TEST
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  keyboardType,
  secureTextEntry,
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>
        {label}
      </Text>

      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#667A91"
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        autoCapitalize={
          keyboardType === 'email-address'
            ? 'none'
            : 'sentences'
        }
        autoCorrect={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#05091B',
  },

  screen: {
    flex: 1,
    backgroundColor: '#05091B',
  },

  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 34,
    flexGrow: 1,
  },

  logoWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    marginBottom: 18,
  },

  logoCircle: {
    width: 104,
    height: 104,
    borderRadius: 52,

    backgroundColor: '#111D56',

    borderWidth: 2,
    borderColor: '#5BE8FF',

    alignItems: 'center',
    justifyContent: 'center',

    shadowColor: '#795CFF',
    shadowOpacity: 0.88,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 0 },

    elevation: 15,
  },

  logoIcon: {
    fontSize: 49,

    textShadowColor: '#54E9FF',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 16,
  },

  appName: {
    color: '#F7FBFF',
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 1.1,
    marginTop: 14,

    textShadowColor: 'rgba(88,226,255,0.34)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 9,
  },

  tagline: {
    color: '#9EB5D1',
    fontSize: 12.5,
    fontWeight: '600',
    textAlign: 'center',

    marginTop: 6,
    marginBottom: 22,

    letterSpacing: 0.12,
  },

  authCard: {
    backgroundColor: 'rgba(14, 22, 59, 0.95)',

    borderRadius: 30,

    paddingHorizontal: 18,
    paddingVertical: 18,

    borderWidth: 1.2,
    borderColor: '#3E5EB2',

    shadowColor: '#536DFF',
    shadowOpacity: 0.34,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 9 },

    elevation: 10,
  },

  modeRow: {
    flexDirection: 'row',

    backgroundColor: 'rgba(5, 12, 40, 0.92)',

    borderRadius: 22,
    padding: 4,

    borderWidth: 1,
    borderColor: 'rgba(95,116,230,0.42)',

    marginBottom: 22,
  },

  modeButton: {
    flex: 1,

    minHeight: 46,

    borderRadius: 18,

    alignItems: 'center',
    justifyContent: 'center',

    marginHorizontal: 2,
  },

  modeButtonActive: {
    backgroundColor: '#2457DF',

    borderWidth: 1.2,
    borderColor: '#62E8FF',

    shadowColor: '#5CEAFF',
    shadowOpacity: 0.58,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 3 },

    elevation: 8,
  },

  modeText: {
    color: '#8B9DBA',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.15,
  },

  modeTextActive: {
    color: '#FFFFFF',
    fontWeight: '900',

    textShadowColor: '#5CEAFF',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },

  title: {
    color: '#FFFFFF',

    fontSize: 27,
    fontWeight: '900',

    letterSpacing: -0.65,

    marginTop: 2,
    marginBottom: 5,

    textShadowColor: 'rgba(110,101,255,0.42)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 11,
  },

  subtitle: {
    color: '#A0B4D1',

    fontSize: 12.5,
    fontWeight: '600',

    lineHeight: 18,
    marginBottom: 20,
  },

  fieldWrap: {
    marginBottom: 15,
  },

  label: {
    color: '#79E8FF',

    fontSize: 9.5,
    fontWeight: '900',

    letterSpacing: 1.1,

    marginBottom: 7,

    textShadowColor: 'rgba(83,226,255,0.24)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },

  input: {
    minHeight: 52,

    backgroundColor: 'rgba(8, 17, 50, 0.94)',

    borderWidth: 1.2,
    borderColor: '#3A7BDB',

    borderRadius: 18,

    paddingVertical: 14,
    paddingHorizontal: 16,

    color: '#FFFFFF',

    fontSize: 14,
    fontWeight: '650',

    shadowColor: '#42CFFF',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },

  primaryButton: {
    minHeight: 58,

    marginTop: 7,

    borderRadius: 20,

    backgroundColor: '#2858F4',

    borderWidth: 1.5,
    borderColor: '#5DEAFF',

    alignItems: 'center',
    justifyContent: 'center',

    shadowColor: '#5A6CFF',
    shadowOpacity: 0.78,
    shadowRadius: 23,
    shadowOffset: { width: 0, height: 7 },

    elevation: 13,
  },

  primaryButtonText: {
    color: '#FFFFFF',

    fontSize: 15,
    fontWeight: '900',

    letterSpacing: 1.15,

    textShadowColor: '#65E9FF',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 9,
  },

  disabled: {
    opacity: 0.6,
  },

  forgotButton: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  forgotText: {
    color: '#62DFFF',

    fontSize: 11.5,
    fontWeight: '800',

    letterSpacing: 0.15,

    textShadowColor: 'rgba(92,234,255,0.25)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },

  testBox: {
    backgroundColor: 'rgba(7, 54, 52, 0.72)',

    borderRadius: 24,

    paddingHorizontal: 16,
    paddingVertical: 15,

    marginTop: 18,

    borderWidth: 1.2,
    borderColor: '#27D9B4',

    shadowColor: '#22E5B9',
    shadowOpacity: 0.20,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
  },

  testTitle: {
    color: '#62F0C9',

    fontWeight: '900',
    fontSize: 12.5,

    letterSpacing: 0.2,
  },

  testText: {
    color: '#A5C9C5',

    fontSize: 10.5,
    lineHeight: 15,

    marginTop: 5,
  },

  testButton: {
    minHeight: 45,

    backgroundColor: 'rgba(24, 121, 105, 0.48)',

    borderRadius: 16,

    paddingHorizontal: 13,

    alignItems: 'center',
    justifyContent: 'center',

    marginTop: 12,

    borderWidth: 1,
    borderColor: 'rgba(78,235,202,0.42)',
  },

  testButtonText: {
    color: '#8DFFE2',

    fontWeight: '900',
    fontSize: 10.5,

    letterSpacing: 0.55,
  },

  footer: {
    color: '#63718D',

    textAlign: 'center',

    fontSize: 9,

    fontWeight: '700',

    letterSpacing: 0.65,

    marginTop: 22,
    marginBottom: 6,
  },
});