import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { manualErrors, type ManualFields } from '../core/input';
import type { Theme } from '../theme';
import { Field, Icon, NavBar, Pill, RoundButton } from '../ui';

type Key = keyof ManualFields;
export const EMPTY_MANUAL: ManualFields = { email: '', token: '', androidId: '', alias: '' };

export function Manual({ theme, value, onChange, touched, onTouch, onPaste, onGenerate, onBack, error }: {
  theme: Theme; value: ManualFields; onChange: (value: ManualFields) => void; touched: Partial<Record<Key, boolean>>; onTouch: (key: Key) => void;
  onPaste: () => void; onGenerate: () => void; onBack: () => void; error: string;
}) {
  const insets = useSafeAreaInsets();
  const [focus, setFocus] = useState<Key>();
  const errors = manualErrors(value), valid = Object.keys(errors).length === 0;
  const shown = (key: Key) => value[key] && touched[key] && focus !== key ? errors[key] : undefined;
  const field = (key: Key) => ({
    value: value[key], error: shown(key), onChange: (text: string) => onChange({ ...value, [key]: text }),
    onBlur: () => { setFocus(undefined); onTouch(key); }, inputProps: { onFocus: () => setFocus(key) },
  });
  return <KeyboardAvoidingView style={[styles.page, { backgroundColor: theme.background, paddingTop: insets.top }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <NavBar theme={theme} left={<RoundButton theme={theme} label="返回" icon="back" onPress={onBack} />} title="手动配置" />
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Pressable accessibilityRole="button" onPress={onPaste} style={({ pressed }) => [styles.paste, { backgroundColor: theme.accentSoft, opacity: pressed ? 0.75 : 1 }]}>
        <Icon name="clip" size={18} color={theme.accentSoftForeground} />
        <Text style={[styles.pasteText, { color: theme.accentSoftForeground }]}>粘贴认证请求自动填写</Text>
      </Pressable>
      {!!error && <Text accessibilityRole="alert" style={[styles.error, { color: theme.danger }]}>{error}</Text>}
      <Field theme={theme} label="邮箱" placeholder="name@gmail.com" {...field('email')} inputProps={{ ...field('email').inputProps, keyboardType: 'email-address' }} />
      <Field theme={theme} label="Master Token" placeholder="aas_et/…" monospace secure {...field('token')} />
      <Field theme={theme} label="Android ID" placeholder="16 位十六进制" monospace {...field('androidId')} />
      <Field theme={theme} label="绑定 alias" placeholder="可选" monospace secure hint="账号绑定过设备时才需要" {...field('alias')} />
    </ScrollView>
    <View style={[styles.bottom, { paddingBottom: Math.max(40, insets.bottom + 12) }]}>
      <Pill theme={theme} title="生成" disabled={!valid} onPress={onGenerate} />
    </View>
  </KeyboardAvoidingView>;
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  scroll: { flex: 1 },
  content: { paddingTop: 4, paddingHorizontal: 16, paddingBottom: 16, gap: 16 },
  paste: { height: 44, borderRadius: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  pasteText: { fontSize: 16, fontWeight: '600' },
  error: { paddingHorizontal: 4, fontSize: 13, lineHeight: 18, textAlign: 'center' },
  bottom: { paddingHorizontal: 20, paddingTop: 8 },
});
