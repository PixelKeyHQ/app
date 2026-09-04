import { requireNativeModule } from 'expo';

type WebCookies = {
  getCookie(url: string, name: string): Promise<string | null>;
  clearAll(): Promise<void>;
};

export default requireNativeModule<WebCookies>('WebCookies');
