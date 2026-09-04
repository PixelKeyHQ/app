import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'Pixel Key', slug: 'pixelkey', version: '0.1.0', scheme: 'pixelkey',
  owner: 'pixelkey', extra: { eas: { projectId: '30ea39b8-abf5-49fe-bf8c-f048fe0ee6d0' } },
  platforms: ['ios', 'android'],
  icon: './assets/icon.png',
  plugins: [['expo-build-properties', { ios: { enableSceneSupport: true, networkInspector: false }, android: { networkInspector: false } }]],
  orientation: 'portrait', userInterfaceStyle: 'automatic',
  ios: { bundleIdentifier: 'io.github.pixelkeyhq.app', supportsTablet: true },
  android: {
    package: 'io.github.pixelkeyhq.app', allowBackup: false,
    adaptiveIcon: { foregroundImage: './assets/adaptive-foreground.png', backgroundImage: './assets/adaptive-background.png' },
    blockedPermissions: ['android.permission.READ_EXTERNAL_STORAGE', 'android.permission.WRITE_EXTERNAL_STORAGE', 'android.permission.SYSTEM_ALERT_WINDOW', 'android.permission.RECORD_AUDIO', 'android.permission.READ_MEDIA_IMAGES'],
  },
};
export default config;
