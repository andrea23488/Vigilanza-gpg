import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

export default function TipoGiornataSection({ tipo, setTipo, styles }) {
  return (
    <>
      <Text
        style={
          styles.label
        }
      >
        TIPO GIORNATA
      </Text>

      <View
        style={
          styles.types
        }
      >
        {[
          [
            'turno',
            'Turno',
          ],

          [
            'riposo',
            'Riposo',
          ],

          [
            'ferie',
            'Ferie',
          ],

          [
            'malattia',
            'Malattia',
          ],

          [
            'permesso',
            'Permesso',
          ],

          [
            'congedo80',
            'Congedo parentale 80%',
          ],

          [
            'congedo30',
            'Congedo parentale 30%',
          ],

          [
            'legge104',
            'Permesso L.104',
          ],
        ].map(
          ([
            id,
            nome,
          ]) => (
            <TouchableOpacity
              key={
                id
              }
              style={[
                styles.type,

                tipo ===
                  id &&
                  styles.typeSelected,
              ]}
              onPress={() =>
                setTipo(
                  id
                )
              }
            >
              <Text
                style={[
                  styles.typeText,

                  tipo ===
                    id &&
                    styles.typeTextSelected,
                ]}
              >
                {nome}
              </Text>
            </TouchableOpacity>
          )
        )}
      </View>
    </>
  );
}
