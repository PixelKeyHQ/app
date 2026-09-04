import { useEffect, useRef, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { MOCK, MOCK_LOGIN_HTML } from '../mock';
import * as platform from '../platform';
import type { Theme } from '../theme';
import { Icon } from '../ui';

const staysInSheet = (url: string) => /^https:\/\//i.test(url) || url.startsWith('about:');
const hostOf = (url: string) => /^https?:\/\/([^/?#]+)/i.exec(url)?.[1] ?? '';

export function LoginSheet({ theme, visible, covered, onToken, onCancel }: {
  theme: Theme; visible: boolean; covered: boolean; onToken: (token: string) => void; onCancel: () => void;
}) {
  const [host, setHost] = useState(hostOf(platform.loginUrl));
  const done = useRef(false), reading = useRef(false);
  useEffect(() => { if (visible) { done.current = false; setHost(hostOf(platform.loginUrl)); } }, [visible]);
  async function check() {
    if (!visible || done.current || reading.current) return;
    reading.current = true;
    try {
      const token = await platform.loginToken();
      if (token && !done.current) { done.current = true; onToken(token); }
    } catch {} finally { reading.current = false; }
  }
  const checkRef = useRef(check); checkRef.current = check;
  useEffect(() => {
    if (!visible) return;
    const timer = setInterval(() => { void checkRef.current(); }, 1000);
    return () => clearInterval(timer);
  }, [visible]);

  const source = MOCK ? { html: MOCK_LOGIN_HTML, baseUrl: platform.loginUrl } : { uri: platform.loginUrl };
  return <Modal visible={visible} animationType="slide" presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'} onRequestClose={onCancel}>
    <SafeAreaProvider>
      <SafeAreaView edges={Platform.OS === 'ios' ? ['bottom'] : ['top', 'bottom']} style={[styles.sheet, { backgroundColor: theme.surface }]}>
        <View style={[styles.bar, { borderBottomColor: theme.separator }]}>
          <Pressable accessibilityRole="button" hitSlop={12} onPress={onCancel}><Text style={[styles.cancel, { color: theme.accent }]}>取消</Text></Pressable>
          <View style={styles.host}><Icon name="lock" size={13} width={2.4} color={theme.muted} /><Text style={[styles.hostText, { color: theme.muted }]} numberOfLines={1}>{host}</Text></View>
          <View style={{ width: 34 }} />
        </View>
        {visible && <WebView source={source} incognito cacheEnabled={false}
          onShouldStartLoadWithRequest={request => staysInSheet(request.url)}
          setSupportMultipleWindows={false} javaScriptCanOpenWindowsAutomatically={false} allowsLinkPreview={false}
          style={{ flex: 1, backgroundColor: '#FFFFFF' }}
          onNavigationStateChange={state => { setHost(hostOf(state.url) || host); void check(); }} onLoadEnd={() => { void check(); }} />}
        {covered && <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.surface }]} />}
      </SafeAreaView>
    </SafeAreaProvider>
  </Modal>;
}

const styles = StyleSheet.create({
  sheet: { flex: 1 },
  bar: { height: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  cancel: { fontSize: 17 },
  host: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  hostText: { fontSize: 14 },
});
