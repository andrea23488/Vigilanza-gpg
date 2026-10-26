import AsyncStorage from '@react-native-async-storage/async-storage';
const prefix='@vigilanza_beta:';
export default {getItem:key=>AsyncStorage.getItem(prefix+key),setItem:(key,value)=>AsyncStorage.setItem(prefix+key,value)};
