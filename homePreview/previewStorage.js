import AsyncStorage from '@react-native-async-storage/async-storage';

// Metro maps only the shared Home's storage import here. Keep demo preferences separate.
const prefix = '@vigilanza_home_preview:';
export default {
  getItem: key => AsyncStorage.getItem(prefix + key),
  setItem: (key, value) => AsyncStorage.setItem(prefix + key, value),
};
