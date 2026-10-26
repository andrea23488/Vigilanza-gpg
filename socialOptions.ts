// Identificativi delle quattro destinazioni Social reali.
export const SOCIAL_OPTIONS = [
  { id: 'shared-shifts', label: 'TURNI CONDIVISI', icon: 'calendar-outline', description: 'La programmazione insieme ai tuoi colleghi.' },
  { id: 'chat', label: 'CHAT', icon: 'chatbubble-ellipses-outline', description: 'Le tue conversazioni, in un unico spazio.' },
  { id: 'colleague-profiles', label: 'PROFILI COLLEGHI', icon: 'people-outline', description: 'I colleghi collegati e i loro profili.' },
  { id: 'find-colleague', label: 'CERCA NUOVO COLLEGA', icon: 'search-outline', description: 'Trova un collega con cui collegarti.' },
] as const;
export type SocialOptionId = typeof SOCIAL_OPTIONS[number]['id'];
