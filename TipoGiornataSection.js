import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const TIPI_PRINCIPALI = [
  ['turno', 'Turno', 'briefcase-outline'],
  ['riposo', 'Riposo', 'moon-outline'],
];

const ALTRE_CAUSALI = [
  ['ferie', 'Ferie'],
  ['malattia', 'Malattia'],
  ['permesso', 'Permesso'],
  ['congedo80', 'Congedo parentale 80%'],
  ['congedo30', 'Congedo parentale 30%'],
  ['legge104', 'Permesso L.104'],
];

export default function TipoGiornataSection({ tipo, setTipo, styles }) {
  const [altreCausaliAperte, setAltreCausaliAperte] = useState(false);
  const causaleAttiva = ALTRE_CAUSALI.find(([id]) => id === tipo);
  const coloreTesto = StyleSheet.flatten(styles.typeText).color;
  const coloreSelezionato = StyleSheet.flatten(styles.typeTextSelected).color;
  const coloreAccento = StyleSheet.flatten(styles.label).color;

  return (
    <View style={[styles.type, localStyles.section]}>
      <Text style={[styles.label, localStyles.heading]}>TIPO GIORNATA</Text>

      <View style={localStyles.primaryRow}>
        {TIPI_PRINCIPALI.map(([id, nome, icona]) => {
          const selezionato = tipo === id;
          const colore = selezionato ? coloreSelezionato : coloreTesto;

          return (
            <TouchableOpacity
              key={id}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={nome}
              accessibilityState={{ selected: selezionato }}
              onPress={() => setTipo(id)}
              style={[
                styles.type,
                localStyles.primaryButton,
                selezionato && styles.typeSelected,
              ]}
            >
              <Ionicons name={icona} size={22} color={colore} accessible={false} />
              <Text
                style={[
                  styles.typeText,
                  localStyles.primaryText,
                  selezionato && styles.typeTextSelected,
                ]}
              >
                {nome}
              </Text>
              {selezionato && (
                <Ionicons name="checkmark-circle" size={17} color={colore} accessible={false} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={
          causaleAttiva ? `Altre causali, causale attiva: ${causaleAttiva[1]}` : 'Altre causali'
        }
        accessibilityState={{ expanded: altreCausaliAperte }}
        accessibilityHint="Mostra o nasconde le altre causali senza cambiare la selezione"
        onPress={() => setAltreCausaliAperte((aperte) => !aperte)}
        style={[styles.type, localStyles.disclosure]}
      >
        <Ionicons name="list-outline" size={20} color={coloreAccento} accessible={false} />
        <View style={localStyles.disclosureText}>
          <Text style={styles.typeText}>Altre causali</Text>
          {causaleAttiva && (
            <Text style={[styles.typeText, localStyles.activeText, { color: coloreAccento }]}>
              {causaleAttiva[1]}
            </Text>
          )}
        </View>
        {causaleAttiva && (
          <Ionicons name="checkmark-circle" size={18} color={coloreAccento} accessible={false} />
        )}
        <Ionicons
          name={altreCausaliAperte ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={coloreTesto}
          accessible={false}
        />
      </TouchableOpacity>

      {altreCausaliAperte && (
        <View style={localStyles.secondaryList}>
          {ALTRE_CAUSALI.map(([id, nome]) => {
            const selezionato = tipo === id;

            return (
              <TouchableOpacity
                key={id}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={nome}
                accessibilityState={{ selected: selezionato }}
                onPress={() => setTipo(id)}
                style={[
                  styles.type,
                  localStyles.secondaryButton,
                  selezionato && styles.typeSelected,
                ]}
              >
                <Text
                  style={[
                    styles.typeText,
                    localStyles.secondaryText,
                    selezionato && styles.typeTextSelected,
                  ]}
                >
                  {nome}
                </Text>
                <Ionicons
                  name={selezionato ? 'checkmark-circle' : 'ellipse-outline'}
                  size={19}
                  color={selezionato ? coloreSelezionato : coloreTesto}
                  accessible={false}
                />
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

const localStyles = StyleSheet.create({
  section: {
    alignItems: 'stretch',
    padding: 12,
    borderRadius: 18,
    marginRight: 0,
    marginBottom: 18,
  },
  heading: {
    marginTop: 0,
    marginBottom: 10,
    fontSize: 11,
  },
  primaryRow: {
    flexDirection: 'row',
    gap: 8,
  },
  primaryButton: {
    flex: 1,
    minWidth: 0,
    minHeight: 60,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    paddingHorizontal: 8,
    marginRight: 0,
    marginBottom: 0,
  },
  primaryText: {
    flexShrink: 1,
    fontSize: 13,
  },
  disclosure: {
    flexDirection: 'row',
    gap: 9,
    minHeight: 48,
    marginTop: 8,
    marginRight: 0,
    marginBottom: 0,
    paddingHorizontal: 10,
  },
  disclosureText: {
    flex: 1,
    minWidth: 0,
  },
  activeText: {
    marginTop: 4,
    lineHeight: 18,
  },
  secondaryList: {
    marginTop: 8,
    gap: 6,
  },
  secondaryButton: {
    minHeight: 48,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginRight: 0,
    marginBottom: 0,
    paddingHorizontal: 12,
  },
  secondaryText: {
    flex: 1,
    lineHeight: 18,
  },
});
