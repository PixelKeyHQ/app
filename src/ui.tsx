import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { cardShadow, mono, type Theme } from './theme';

const ICONS = {
  key: <><Circle cx="8" cy="15" r="4" /><Path d="M11 12l8.5-8.5M16 7l2.5 2.5M14 9l2 2" /></>,
  back: <Path d="M15 5.5L8.5 12l6.5 6.5" />,
  lock: <><Rect x="5" y="10.5" width="14" height="9.5" rx="2" /><Path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" /></>,
  clip: <><Rect x="7" y="4" width="10" height="4" rx="1" /><Path d="M7 6H6a1.5 1.5 0 0 0-1.5 1.5v11A1.5 1.5 0 0 0 6 20h12a1.5 1.5 0 0 0 1.5-1.5v-11A1.5 1.5 0 0 0 18 6h-1" /></>,
  check: <Path d="M5 12.5l4.5 4.5L19 7.5" />,
};
export type IconName = keyof typeof ICONS;
export function Icon({ name, size = 22, color, width = 2 }: { name: IconName; size?: number; color: string; width?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round">{ICONS[name]}</Svg>;
}
export function Chevron({ color }: { color: string }) {
  return <Svg width={8} height={14} viewBox="0 0 8 14" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><Path d="M1 1l6 6-6 6" /></Svg>;
}

export function AppIcon({ size = 88 }: { size?: number }) {
  return <View style={{ width: size, height: size, borderRadius: Math.round(size * 0.26), experimental_backgroundImage: 'linear-gradient(160deg, #A58BFF, #6E4BC7)', alignItems: 'center', justifyContent: 'center', boxShadow: '0px 8px 24px rgba(110,75,199,0.28)' }}>
    <Icon name="key" size={size * 0.5} color="#FFFFFF" />
  </View>;
}

export function Card({ theme, children, style }: { theme: Theme; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ backgroundColor: theme.surface, borderRadius: 24, overflow: 'hidden' }, cardShadow(theme), style]}>{children}</View>;
}

export function Pill({ theme, title, icon, onPress, kind = 'primary', disabled = false }: { theme: Theme; title: string; icon?: IconName; onPress: () => void; kind?: 'primary' | 'secondary'; disabled?: boolean }) {
  const bg = kind === 'primary' ? theme.accent : theme.default, fg = kind === 'primary' ? theme.accentForeground : theme.foreground;
  return <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [styles.pill, { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 }]}>
    {icon && <Icon name={icon} size={20} color={fg} width={icon === 'check' ? 2.4 : 2} />}
    <Text style={[styles.pillText, { color: fg }]}>{title}</Text>
  </Pressable>;
}

export function NavBar({ theme, left, title = '', right }: { theme: Theme; left?: ReactNode; title?: string; right?: ReactNode }) {
  return <View style={styles.nav}>
    <View style={styles.navSide}>{left}</View>
    <Text style={[styles.navTitle, { color: theme.foreground }]}>{title}</Text>
    <View style={[styles.navSide, { justifyContent: 'flex-end' }]}>{right}</View>
  </View>;
}
export function NavText({ theme, title, onPress }: { theme: Theme; title: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" hitSlop={12} onPress={onPress}><Text style={{ color: theme.accent, fontSize: 17, fontWeight: '600' }}>{title}</Text></Pressable>;
}
export function RoundButton({ theme, label, icon, onPress }: { theme: Theme; label: string; icon: IconName; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
    style={({ pressed }) => [styles.round, { backgroundColor: theme.navButton, boxShadow: `0px 1px 3px rgba(0,0,0,0.08), 0px 0px 0px 0.5px ${theme.separator}`, opacity: pressed ? 0.7 : 1 }]}>
    <Icon name={icon} color={theme.foreground} />
  </Pressable>;
}

export function GoogleButton({ theme, onPress }: { theme: Theme; onPress: () => void }) {
  const title = '登录 Google 获取配置密钥';
  return <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress}
    style={({ pressed }) => [styles.google, { backgroundColor: theme.googleFill, borderColor: theme.googleStroke, opacity: pressed ? 0.85 : 1 }]}>
    <Svg width={20} height={20} viewBox="0 0 48 48">
      <Path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <Path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <Path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <Path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </Svg>
    <Text style={[styles.googleText, { color: theme.googleText }]}>{title}</Text>
  </Pressable>;
}

export function Spinner({ theme, size = 20 }: { theme: Theme; size?: number }) {
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 900, easing: Easing.linear, useNativeDriver: true }));
    loop.start(); return () => loop.stop();
  }, [spin]);
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return <Animated.View style={{ transform: [{ rotate }] }}>
    <Svg width={size} height={size} viewBox="0 0 20 20">
      <Circle cx="10" cy="10" r="8" fill="none" stroke={theme.separator} strokeWidth={2.5} />
      <Path d="M10 2a8 8 0 0 1 8 8" fill="none" stroke={theme.accent} strokeWidth={2.5} strokeLinecap="round" />
    </Svg>
  </Animated.View>;
}

export const quietInput: TextInputProps = {
  autoCapitalize: 'none', autoCorrect: false, spellCheck: false, autoComplete: 'off', textContentType: 'none', importantForAutofill: 'no', maxLength: 65536,
};

const noPasswordSave: TextInputProps = Platform.OS === 'ios' ? { textContentType: 'oneTimeCode' } : {};

export function Field({ theme, label, value, onChange, onBlur, placeholder, monospace = false, secure = false, error, hint, inputProps }: {
  theme: Theme; label: string; value: string; onChange: (text: string) => void; onBlur?: () => void; placeholder: string;
  monospace?: boolean; secure?: boolean; error?: string; hint?: string; inputProps?: TextInputProps;
}) {
  return <View style={{ gap: 6 }}>
    <Text style={[styles.fieldLabel, { color: theme.foreground }]}>{label}</Text>
    <View style={[styles.fieldBox, { backgroundColor: theme.field, borderColor: error ? theme.danger : 'transparent' }, cardShadow(theme)]}>
      <TextInput {...quietInput} {...inputProps} accessibilityLabel={label} value={value} onChangeText={onChange} onBlur={onBlur} placeholder={placeholder}
        placeholderTextColor={theme.tertiary} cursorColor={theme.accent} selectionColor={theme.accent} secureTextEntry={secure} multiline={false} {...(secure ? noPasswordSave : {})}
        style={[styles.fieldInput, { color: theme.foreground }, monospace ? { fontFamily: mono, fontSize: 15 } : { fontSize: 17 }]} />
    </View>
    {error ? <Text accessibilityRole="alert" style={[styles.below, { color: theme.danger }]}>{error}</Text>
      : hint ? <Text style={[styles.below, { color: theme.muted }]}>{hint}</Text> : null}
  </View>;
}

export const styles = StyleSheet.create({
  pill: { height: 50, borderRadius: 25, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  pillText: { fontSize: 17, fontWeight: '600' },
  nav: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  navSide: { width: 64, flexDirection: 'row' },
  navTitle: { fontSize: 17, fontWeight: '600' },
  round: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  google: { minHeight: 48, borderRadius: 24, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 16 },
  googleText: { fontSize: 16, fontWeight: '500', letterSpacing: 0.25, ...Platform.select({ android: { fontFamily: 'sans-serif-medium', fontWeight: 'normal' as const } }) },
  fieldLabel: { paddingHorizontal: 4, fontSize: 15, fontWeight: '500' },
  fieldBox: { height: 48, borderRadius: 14, borderWidth: 1.5, justifyContent: 'center', paddingHorizontal: 14 },
  fieldInput: { height: 45, padding: 0 },
  below: { paddingHorizontal: 4, fontSize: 13, lineHeight: 18 },
});
