import * as documenti from 'expo-document-picker';
import * as immagini from 'expo-image-picker';
import * as file from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { creaAcquisitore } from './acquisizione';
import { creaPorteAcquisizioneExpo } from './acquisizioneExpo';

/** Creare nel futuro flusso UI, mai durante import o riconoscimento dei turni. */
export function creaAcquisitoreNativo() {
  return creaAcquisitore(creaPorteAcquisizioneExpo({ documenti, immagini, file, piattaforma: Platform.OS }));
}
