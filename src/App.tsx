import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, BackHandler, Platform, StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { safeMessage } from './core/errors';
import { connectGoogle } from './core/google-auth';
import { manualProfile, parseAuthRequest, type ManualFields } from './core/input';
import { DEFAULT_MODEL, type Model, type Profile } from './core/profile';
import { Session } from './core/session';
import * as platform from './platform';
import { Home } from './screens/Home';
import { LoginSheet } from './screens/LoginSheet';
import { EMPTY_MANUAL, Manual } from './screens/Manual';
import { ModelPicker } from './screens/ModelPicker';
import { Result } from './screens/Result';
import { useTheme } from './theme';

type Screen = 'home' | 'model' | 'manual' | 'result';
const ALL_TOUCHED = { email: true, token: true, androidId: true, alias: true };

export default function App() {
  const theme = useTheme();
  const session = useRef(new Session()).current;
  const [screen, setScreen] = useState<Screen>('home');
  const [model, setModel] = useState<Model>(DEFAULT_MODEL);
  const [loginOpen, setLoginOpen] = useState(false), loginRef = useRef(false);
  const [working, setWorking] = useState(false), [error, setError] = useState('');
  const [profile, setProfile] = useState<Profile>();
  const [manual, setManual] = useState<ManualFields>(EMPTY_MANUAL), [touched, setTouched] = useState<Partial<Record<keyof ManualFields, boolean>>>({});
  const [manualError, setManualError] = useState('');

  const showLogin = (open: boolean) => { loginRef.current = open; setLoginOpen(open); };
  const clear = useCallback(() => {
    session.clear(); showLogin(false); setWorking(false); setError(''); setProfile(undefined); setScreen('home');
    setManual(EMPTY_MANUAL); setTouched({}); setManualError('');
    platform.clearWebData().catch(() => undefined);
  }, [session]);

  const [covered, setCovered] = useState(false);
  useEffect(() => {
    const state = AppState.addEventListener('change', next => {
      setCovered(next === 'inactive');
      const handOff = platform.pausesForSystemUi && loginRef.current;
      if (next === 'background' && !handOff) clear();
    });
    return () => { session.clear(); state.remove(); };
  }, [clear, session]);
  const sensitive = loginOpen || working || !!profile || screen === 'manual';
  useEffect(() => { platform.protectScreen(sensitive).catch(() => undefined); }, [sensitive]);

  useEffect(() => {
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      if (screen === 'home') return false;
      if (screen === 'result') clear();
      else if (screen === 'manual') void platform.forgetTypedSecrets().then(() => setScreen('home'));
      else setScreen('home');
      return true;
    });
    return () => back.remove();
  }, [screen, clear]);

  async function startLogin() {
    clear();
    await platform.protectScreen(true).catch(() => undefined);
    showLogin(true);
  }
  async function closeLogin() {
    await platform.clearWebData().catch(() => undefined);
    showLogin(false);
    await platform.clearWebData().catch(() => undefined);
  }
  async function onToken(token: string) {
    const task = session.begin(); setWorking(true); setError('');
    await closeLogin();
    try {
      const next = await connectGoogle(token, platform.transport, platform.randomBytes, task.signal, model);
      if (!task.current()) return;
      setProfile(next); setScreen('result');
    } catch (e) { if (task.current()) setError(safeMessage(e)); }
    finally { if (task.current()) setWorking(false); }
  }

  async function paste() {
    setManualError('');
    try {
      const fields = parseAuthRequest(await platform.pasteText());
      setManual(fields); setTouched(ALL_TOUCHED);
    } catch (e) { setManualError(safeMessage(e)); }
  }
  async function generate() {
    setManualError('');
    let next;
    try { next = manualProfile(manual, model); }
    catch (e) { setManualError(safeMessage(e)); return; }
    await platform.forgetTypedSecrets();
    setProfile(next); setManual(EMPTY_MANUAL); setTouched({}); setScreen('result');
  }
  async function leaveManual() {
    await platform.forgetTypedSecrets();
    clear();
  }

  return <SafeAreaProvider>
    <StatusBar barStyle={Platform.OS === 'ios' ? 'default' : theme.dark ? 'light-content' : 'dark-content'} />
    <View style={[styles.page, { backgroundColor: theme.background }]}>
      {screen === 'home' && <Home theme={theme} model={model} working={working} error={error}
        onModel={() => setScreen('model')} onGoogle={() => { void startLogin(); }} onManual={() => { clear(); setScreen('manual'); }} />}
      {screen === 'model' && <ModelPicker theme={theme} model={model} onPick={setModel} onDone={() => setScreen('home')} />}
      {screen === 'manual' && <Manual theme={theme} value={manual} onChange={setManual} touched={touched} onTouch={key => setTouched(t => ({ ...t, [key]: true }))}
        onPaste={() => { void paste(); }} onGenerate={() => { void generate(); }} onBack={() => { void leaveManual(); }} error={manualError} />}
      {screen === 'result' && profile && <Result theme={theme} profile={profile} onDone={clear} onCopy={async code => { await platform.copyText(code); }} />}
    </View>
    <LoginSheet theme={theme} visible={loginOpen} covered={covered} onToken={token => { void onToken(token); }} onCancel={() => { void closeLogin(); }} />
    {covered && <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.background }]} />}
  </SafeAreaProvider>;
}

const styles = StyleSheet.create({ page: { flex: 1 } });
