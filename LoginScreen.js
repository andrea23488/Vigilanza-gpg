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
} from 'react-native';

const COLORS = {
  bg: '#07111F',
  card: '#101C2D',
  border: '#203550',
  white: '#FFFFFF',
  muted: '#91A3BA',
  blue: '#168BFF',
  lightBlue: '#55B8FF',
};

export default function LoginScreen({ onEnterTest }) {
  const [mode, setMode] = useState('login');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nome, setNome] = useState('');
  const [cognome, setCognome] = useState('');

  function continua() {
    if (!email.trim() || !password.trim()) {
      Alert.alert(
        'Dati mancanti',
        'Inserisci email e password.'
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

    Alert.alert(
      mode === 'login'
        ? 'Accesso'
        : 'Registrazione',
      'Nel prossimo passaggio collegheremo questa schermata a Supabase Auth.'
    );
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
            <Text style={styles.logoIcon}>🛡️</Text>
          </View>

          <Text style={styles.appName}>
            VIGILANZA GPG
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
                mode === 'login' &&
                  styles.modeButtonActive,
              ]}
              onPress={() => setMode('login')}
            >
              <Text
                style={[
                  styles.modeText,
                  mode === 'login' &&
                    styles.modeTextActive,
                ]}
              >
                Accedi
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.modeButton,
                mode === 'register' &&
                  styles.modeButtonActive,
              ]}
              onPress={() => setMode('register')}
            >
              <Text
                style={[
                  styles.modeText,
                  mode === 'register' &&
                    styles.modeTextActive,
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
              : 'Crea il profilo che userai nell’app.'}
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
            placeholder="••••••••"
            secureTextEntry
          />

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={continua}
          >
            <Text style={styles.primaryButtonText}>
              {mode === 'login'
                ? 'ACCEDI'
                : 'CREA ACCOUNT'}
            </Text>
          </TouchableOpacity>

          {mode === 'login' && (
            <TouchableOpacity
              style={styles.forgotButton}
              onPress={() =>
                Alert.alert(
                  'Password dimenticata',
                  'La collegheremo a Supabase Auth nel prossimo passaggio.'
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
            Per ora puoi entrare nell’app senza account mentre completiamo il sistema di accesso.
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
          VIGILANZA GPG • PROTOTIPO
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
    backgroundColor: COLORS.bg,
  },

  screen: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },

  content: {
    padding: 20,
    paddingTop: 45,
    paddingBottom: 60,
  },

  logoWrap: {
    alignItems: 'center',
    marginBottom: 28,
  },

  logoCircle: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: '#10304B',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#1C4D73',
  },

  logoIcon: {
    fontSize: 38,
  },

  appName: {
    color: COLORS.white,
    fontSize: 27,
    fontWeight: '900',
    letterSpacing: 1,
  },

  tagline: {
    color: COLORS.muted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 7,
    lineHeight: 18,
    maxWidth: 310,
  },

  authCard: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 18,
  },

  modeRow: {
    flexDirection: 'row',
    backgroundColor: '#091728',
    borderRadius: 14,
    padding: 4,
    marginBottom: 24,
  },

  modeButton: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 11,
    alignItems: 'center',
  },

  modeButtonActive: {
    backgroundColor: COLORS.blue,
  },

  modeText: {
    color: COLORS.muted,
    fontWeight: '900',
    fontSize: 13,
  },

  modeTextActive: {
    color: COLORS.white,
  },

  title: {
    color: COLORS.white,
    fontSize: 25,
    fontWeight: '900',
  },

  subtitle: {
    color: COLORS.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 5,
    marginBottom: 20,
  },

  fieldWrap: {
    marginBottom: 15,
  },

  label: {
    color: COLORS.muted,
    fontSize: 10,
    fontWeight: '900',
    marginBottom: 7,
  },

  input: {
    backgroundColor: '#091728',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingHorizontal: 15,
    paddingVertical: 14,
    color: COLORS.white,
    fontSize: 15,
  },

  primaryButton: {
    backgroundColor: COLORS.blue,
    borderRadius: 15,
    padding: 16,
    alignItems: 'center',
    marginTop: 5,
  },

  primaryButtonText: {
    color: COLORS.white,
    fontWeight: '900',
  },

  forgotButton: {
    paddingVertical: 15,
    alignItems: 'center',
  },

  forgotText: {
    color: COLORS.lightBlue,
    fontSize: 12,
    fontWeight: '700',
  },

  testBox: {
    backgroundColor: '#102A24',
    borderRadius: 18,
    padding: 16,
    marginTop: 18,
    borderWidth: 1,
    borderColor: '#1B493C',
  },

  testTitle: {
    color: '#50D89F',
    fontWeight: '900',
    fontSize: 13,
  },

  testText: {
    color: COLORS.muted,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 5,
  },

  testButton: {
    backgroundColor: '#153A30',
    borderRadius: 13,
    padding: 13,
    alignItems: 'center',
    marginTop: 13,
  },

  testButtonText: {
    color: '#7DE4BD',
    fontWeight: '900',
    fontSize: 11,
  },

  footer: {
    color: '#586D85',
    textAlign: 'center',
    fontSize: 10,
    marginTop: 25,
  },
});