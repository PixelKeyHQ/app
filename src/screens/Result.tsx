import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProfileQr } from '../components/ProfileQr';
import { encodeProfile, profileLink } from '../core/codec';
import { maskedAccount, profileModel, qrFits, type Profile } from '../core/profile';
import { mono, type Theme } from '../theme';
import { Card, NavBar, NavText, Pill } from '../ui';

export function Result({ theme, profile, onDone, onCopy }: {
  theme: Theme; profile: Profile; onDone: () => void; onCopy: (code: string) => Promise<void>;
}) {
  const insets = useSafeAreaInsets();
  const code = useMemo(() => encodeProfile(profile), [profile]), link = useMemo(() => profileLink(profile), [profile]);
  const wrapped = useMemo(() => code.split('').join('\u200B'), [code]);
  const fits = qrFits(link);
  const [mode, setMode] = useState<'qr' | 'text'>(fits ? 'qr' : 'text');
  const [copied, setCopied] = useState(false), [error, setError] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const email = profile.credential.Email ?? '';
  const quality = profile.quality.original ? '原画质' : '节省空间画质';

  async function copy() {
    setError('');
    try {
      await onCopy(code); setCopied(true);
      clearTimeout(timer.current); timer.current = setTimeout(() => setCopied(false), 2000);
    } catch { setError('复制失败。'); }
  }

  const tab = (label: string, value: 'qr' | 'text') => <Pressable accessibilityRole="tab" accessibilityState={{ selected: mode === value }} onPress={() => setMode(value)}
    style={[styles.tab, mode === value && { backgroundColor: theme.surface, boxShadow: '0px 1px 3px rgba(0,0,0,0.12)' }]}>
    <Text style={[styles.tabText, mode === value ? { color: theme.foreground, fontWeight: '600' } : { color: theme.muted }]}>{label}</Text>
  </Pressable>;

  return <View style={[styles.page, { backgroundColor: theme.background, paddingTop: insets.top }]}>
    <NavBar theme={theme} left={<NavText theme={theme} title="完成" onPress={onDone} />} />
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <View style={styles.account}>
        <View style={[styles.avatar, { backgroundColor: theme.accentSoft }]}><Text style={[styles.avatarText, { color: theme.accentSoftForeground }]}>{(email[0] ?? '?').toUpperCase()}</Text></View>
        <View>
          <Text style={[styles.email, { color: theme.foreground }]} numberOfLines={1}>{maskedAccount(email)}</Text>
          <Text style={[styles.meta, { color: theme.muted }]}>{profileModel(profile)} · {quality}</Text>
        </View>
      </View>
      <View style={[styles.tabs, { backgroundColor: theme.default }]}>{tab('二维码', 'qr')}{tab('文本', 'text')}</View>
      <Card theme={theme} style={styles.body}>
        {mode === 'qr' ? fits ? <>
          <ProfileQr link={link} />
          <Text style={[styles.caption, { color: theme.muted }]}>用备份 App 扫码导入</Text>
        </> : <Text style={[styles.caption, { color: theme.muted }]}>太长，放不进二维码，请用文本。</Text> : <>
          <ScrollView nestedScrollEnabled style={[styles.code, { backgroundColor: theme.field }]} contentContainerStyle={{ padding: 14 }}>
            <Text style={[styles.codeText, { color: theme.muted }]}>{wrapped}</Text>
          </ScrollView>
          <Text style={[styles.caption, { color: theme.muted }]}>复制后在备份 App 中粘贴导入</Text>
        </>}
      </Card>
      <Text style={[styles.note, { color: theme.muted }]}>这段信息能直接登录你的 Google 账号，只在自己的设备上扫码或粘贴。</Text>
    </ScrollView>
    <View style={[styles.buttons, { paddingBottom: Math.max(40, insets.bottom + 12) }]}>
      {!!error && <Text accessibilityRole="alert" style={[styles.error, { color: theme.danger }]}>{error}</Text>}
      <Pill theme={theme} title={copied ? '已复制' : '复制连接信息'} icon={copied ? 'check' : 'clip'} onPress={() => { void copy(); }} />
    </View>
  </View>;
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 16, gap: 16 },
  account: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 4 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 17, fontWeight: '700' },
  email: { fontSize: 17, fontWeight: '600' },
  meta: { fontSize: 13 },
  tabs: { flexDirection: 'row', padding: 3, borderRadius: 12 },
  tab: { flex: 1, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  tabText: { fontSize: 14, fontWeight: '500' },
  body: { paddingVertical: 18, paddingHorizontal: 16, gap: 14 },
  caption: { textAlign: 'center', fontSize: 14, lineHeight: 20 },
  code: { height: 272, borderRadius: 16, flexGrow: 0 },
  codeText: { fontFamily: mono, fontSize: 13, lineHeight: 19 },
  note: { paddingHorizontal: 6, fontSize: 13, lineHeight: 18 },
  buttons: { paddingHorizontal: 20, gap: 10 },
  error: { fontSize: 13, lineHeight: 18, textAlign: 'center' },
});
