import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Model } from '../core/profile';
import type { Theme } from '../theme';
import { AppIcon, Card, Chevron, GoogleButton, Spinner } from '../ui';

export function Home({ theme, model, working, error, onModel, onGoogle, onManual }: {
  theme: Theme; model: Model; working: boolean; error: string; onModel: () => void; onGoogle: () => void; onManual: () => void;
}) {
  const insets = useSafeAreaInsets();
  return <View style={[styles.page, { backgroundColor: theme.background, paddingTop: insets.top }]}>
    <View style={styles.hero}>
      <AppIcon />
      <Text style={[styles.name, { color: theme.foreground }]}>Pixel Key</Text>
    </View>
    <View style={[styles.bottom, { paddingBottom: Math.max(40, insets.bottom + 12) }]}>
      <Card theme={theme}>
        <Pressable accessibilityRole="button" accessibilityLabel={`备份机型 ${model}`} disabled={working} onPress={onModel}
          style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}>
          <Text style={[styles.rowLabel, { color: theme.foreground }]}>备份机型</Text>
          <Text style={[styles.rowValue, { color: theme.muted }]}>{model}</Text>
          <Chevron color={theme.tertiary} />
        </Pressable>
      </Card>
      <View style={styles.actions}>
        {working ? <>
          <View style={styles.working}><Spinner theme={theme} /><Text style={[styles.workingText, { color: theme.muted }]}>正在生成…</Text></View>
          <View style={styles.link} />
        </> : <>
          {!!error && <Text accessibilityRole="alert" style={[styles.error, { color: theme.danger }]}>{error}</Text>}
          <GoogleButton theme={theme} onPress={onGoogle} />
          <Pressable accessibilityRole="button" onPress={onManual} style={({ pressed }) => [styles.link, pressed && { opacity: 0.6 }]}>
            <Text style={[styles.linkText, { color: theme.accent }]}>手动配置密钥</Text>
          </Pressable>
        </>}
      </View>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  name: { fontSize: 28, lineHeight: 34, fontWeight: '700' },
  bottom: { paddingHorizontal: 16, gap: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 52, paddingVertical: 12, paddingHorizontal: 16 },
  rowLabel: { flex: 1, fontSize: 17 },
  rowValue: { flexShrink: 1, fontSize: 17, textAlign: 'right' },
  actions: { gap: 6, paddingHorizontal: 4 },
  error: { fontSize: 13, lineHeight: 18, textAlign: 'center', paddingBottom: 4 },
  working: { height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  workingText: { fontSize: 16 },
  link: { height: 44, alignItems: 'center', justifyContent: 'center' },
  linkText: { fontSize: 16, fontWeight: '500' },
});
