import { Platform, useColorScheme } from 'react-native';

const light = {
  dark: false,
  background: '#F5F5F5', surface: '#FFFFFF', field: '#FFFFFF', foreground: '#18181B', muted: '#71717A', tertiary: '#A1A1AA',
  default: '#EBEBEC', separator: 'rgba(0,0,0,0.08)', accent: '#8359E3', accentForeground: '#FCFCFC',
  accentSoft: '#ECE6FB', accentSoftForeground: '#6E4BC7', danger: '#FF383C', navButton: 'rgba(255,255,255,0.9)',
  googleFill: '#FFFFFF', googleStroke: '#747775', googleText: '#1F1F1F',
};
export type Theme = typeof light;
const dark: Theme = {
  dark: true,
  background: '#060607', surface: '#18181B', field: '#18181B', foreground: '#FCFCFC', muted: '#9F9FA9', tertiary: '#71717A',
  default: '#27272A', separator: 'rgba(255,255,255,0.10)', accent: '#9D82F1', accentForeground: '#FCFCFC',
  accentSoft: '#2A2240', accentSoftForeground: '#BBA6FF', danger: '#DB3B3E', navButton: 'rgba(39,39,42,0.9)',
  googleFill: '#131314', googleStroke: '#8E918F', googleText: '#E3E3E3',
};

export function useTheme(): Theme { return useColorScheme() === 'dark' ? dark : light; }

export const mono = Platform.select({ ios: 'Menlo', default: 'monospace' });
export const cardShadow = (theme: Theme) => theme.dark ? {} : {
  boxShadow: '0px 2px 4px rgba(0,0,0,0.04), 0px 1px 2px rgba(0,0,0,0.06), 0px 0px 1px rgba(0,0,0,0.06)',
};
