import type { CapacitorConfig } from '@capacitor/cli';
const config: CapacitorConfig = {
  appId: 'app.mijornada.personal',
  appName: 'Mi Jornada',
  webDir: 'dist',
  android: { allowMixedContent: false },
  plugins: { CapacitorSQLite: { androidIsEncryption: false } },
};
export default config;
