import * as Crypto from 'expo-crypto';
import * as Clipboard from 'expo-clipboard';
import * as ScreenCapture from 'expo-screen-capture';
import { fetch } from 'expo/fetch';
import { Platform } from 'react-native';
import Autofill from '../modules/autofill';
import SecretClipboard from '../modules/secret-clipboard';
import WebCookies from '../modules/web-cookies';
import { LOGIN_URL } from './core/profile';
import { fetchTransport, type AuthTransport } from './core/transport';
import { MOCK, MOCK_LOGIN_URL, mockTransport } from './mock';

export const randomBytes = Crypto.getRandomBytesAsync;
export const transport: AuthTransport = MOCK ? mockTransport : fetchTransport(fetch as typeof globalThis.fetch);
export const copyText = (text: string) => SecretClipboard.copy(text);
export const pasteText = Clipboard.getStringAsync;
export async function forgetTypedSecrets() { await Autofill?.cancel(); }
export const pausesForSystemUi = Platform.OS === 'android';
export async function protectScreen(secure: boolean) {
  if (Platform.OS !== 'android' || MOCK) return;
  await (secure ? ScreenCapture.preventScreenCaptureAsync('material') : ScreenCapture.allowScreenCaptureAsync('material'));
}

export const loginUrl = MOCK ? MOCK_LOGIN_URL : LOGIN_URL;
export async function loginToken(): Promise<string | undefined> {
  return (await WebCookies.getCookie(loginUrl, 'oauth_token')) ?? undefined;
}
export const clearWebData = () => WebCookies.clearAll();
