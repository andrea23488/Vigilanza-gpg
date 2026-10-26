import React, { useEffect, useReducer, useState } from 'react';
import { Alert, BackHandler, Platform, StatusBar, type AlertButton } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import HomeScreen from '../HomeScreen';
import InteractiveThemePreview from './InteractiveThemePreview';
import { PALETTE_ORIGINALE, paletteHomeDaPreferenza, rapportoContrasto, ripristinaAspetto } from '../temi';
import { creaDatiDemo } from './demoData';
import CalendarScreen from './CalendarScreen';
import { agendaReducer, createAgenda } from './calendarModel';
import SettingsScreen, { SettingsDemoDetail } from './SettingsScreen';
import AppearanceScreen from './AppearanceScreen';
import { ThemeProvider } from './ThemeContext';
import { type SettingsOptionId } from './settingsOptions';
import SocialScreen, { SocialDemoDetail } from './SocialScreen';
import { type SocialOptionId } from './socialOptions';
import DemoDialog, { type DemoMessage } from './DemoDialog';

export default function HomeDemo() {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [agenda, dispatchAgenda] = useReducer(agendaReducer, undefined, () => createAgenda());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsOption, setSettingsOption] = useState<SettingsOptionId | null>(null);
  const [savedAppearance, setSavedAppearance] = useState(() => ripristinaAspetto());
  const [draftAppearance, setDraftAppearance] = useState(() => ripristinaAspetto());
  const [appearancePreview, setAppearancePreview] = useState(false);
  const closeSettings = () => { setSettingsOption(null); setSettingsOpen(false); setAppearancePreview(false); };
  const selectSettingsOption = (id: SettingsOptionId) => {
    if (id === 'appearance') { setDraftAppearance({ ...savedAppearance }); setAppearancePreview(false); }
    setSettingsOption(id);
  };
  useEffect(() => {
    if (!appearancePreview || Platform.OS === 'web') return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { setAppearancePreview(false); return true; });
    return () => sub.remove();
  }, [appearancePreview]);
  const [socialOpen, setSocialOpen] = useState(false);
  const [socialOption, setSocialOption] = useState<SocialOptionId | null>(null);
  const closeSocial = () => { setSocialOption(null); setSocialOpen(false); };
  const [dati, setDati] = useState(() => creaDatiDemo());

  const [message, setMessage] = useState<DemoMessage | null>(null);
  const showMessage = (title: string, text: string, buttons: AlertButton[] = [{ text: 'Chiudi' }]) => {
    if (Platform.OS === 'web') setMessage({ title, message: text, buttons });
    else Alert.alert(title, text, buttons);
  };
  const themePreview = appearancePreview || (settingsOpen && settingsOption === 'appearance');
  const activeAppearance = themePreview ? draftAppearance : savedAppearance;
  const palette = paletteHomeDaPreferenza(activeAppearance);
  const colori = palette || PALETTE_ORIGINALE;
  const informa = (titolo: string) => showMessage(titolo, 'Anteprima con dati dimostrativi. Nessun account, servizio cloud o salvataggio di turni.');
  const naviga = (schermata: string) => {
    if (schermata === 'calendar') { setCalendarOpen(true); return; }
    if (schermata === 'aspettoColori') {
      setSettingsOpen(true); selectSettingsOption('appearance');
      return;
    }
    const titoli: Record<string, string> = { calendar: 'Calendario', turni: 'Lista turni', strumenti: 'Strumenti', stipendio: 'Stipendio', listaChat: 'Chat', calendarioColleghi: 'Condivisione turni' };
    informa(`${titoli[schermata] || schermata} · DEMO`);
  };
  return <SafeAreaProvider><ThemeProvider preference={activeAppearance} decorations={!appearancePreview}>
    <StatusBar barStyle={rapportoContrasto('#FFFFFF', colori.background) > rapportoContrasto('#000000', colori.background) ? 'light-content' : 'dark-content'} backgroundColor={colori.background} />
    {calendarOpen ? <CalendarScreen state={agenda} dispatch={dispatchAgenda} summary={agenda.year === dati.summaryYear && agenda.month === dati.summaryMonth ? {ore:dati.ore,extra:dati.extra,notti:dati.notti} : null} onBack={() => setCalendarOpen(false)} /> : socialOpen ? (socialOption
      ? <SocialDemoDetail optionId={socialOption} onBack={() => setSocialOption(null)} onHome={closeSocial} />
      : <SocialScreen onBack={() => setSocialOpen(false)} onSelect={setSocialOption} />) : settingsOpen ? (settingsOption === 'appearance'
      ? appearancePreview ? <InteractiveThemePreview preference={draftAppearance} onPreference={setDraftAppearance} onBack={() => setAppearancePreview(false)} data={dati} />
      : <AppearanceScreen draft={draftAppearance} saved={savedAppearance} onDraft={setDraftAppearance} onSave={() => setSavedAppearance({ ...draftAppearance })}
        onReset={() => { const original = ripristinaAspetto(); setDraftAppearance(original); setSavedAppearance(original); }} onPreview={() => setAppearancePreview(true)} onBack={() => setSettingsOption(null)} />
      : settingsOption ? <SettingsDemoDetail key={settingsOption} optionId={settingsOption} onBack={() => setSettingsOption(null)} onHome={closeSettings} />
      : <SettingsScreen onBack={closeSettings} onSelect={selectSettingsOption} />) : <HomeScreen {...dati} paletteHome={palette} transparentThemeBackground fotoProfilo={null}
      etaServizio={null} etaServizioLoading={false} etaTurno={null}
      onProfile={() => informa(`Profilo ${dati.profilo.nome} · DEMO`)}
      onNotifications={() => informa('3 notifiche dimostrative')}
      onSocial={() => setSocialOpen(true)}
      onSettings={() => setSettingsOpen(true)}
      onCalendar={() => setCalendarOpen(true)}
      onNavigate={naviga}
      onColleghi={() => informa('Colleghi · DEMO')}
      onAddShift={() => showMessage('Servizio dimostrativo', 'Vuoi rigenerare il turno in corso e il countdown di circa tre ore?', [
        { text: 'Rigenera demo', onPress: () => setDati(creaDatiDemo()) },
        { text: 'Annulla', style: 'cancel' },
      ])}
    />}
    {Platform.OS === 'web' && <DemoDialog message={message} onClose={() => setMessage(null)} colors={colori} />}
  </ThemeProvider></SafeAreaProvider>;
}
