import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const testBuild = process.env.EXPO_PUBLIC_PUSH_TEST_BUILD === 'true';
const supabaseKey = testBuild
  ? process.env.EXPO_PUBLIC_PUSH_TEST_SUPABASE_PUBLISHABLE_KEY
  : process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (testBuild && (supabaseUrl !== 'https://ilmhjsrxhnishnbocrnm.supabase.co' || !supabaseKey || process.env.EXPO_PUBLIC_PUSH_REGISTRATION_ENABLED !== 'false')) {
  throw new Error('Configurazione push TEST rifiutata');
}
export { supabaseUrl as SUPABASE_URL, supabaseKey as SUPABASE_KEY };

export const supabase = createClient(
  supabaseUrl,
  supabaseKey,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);
