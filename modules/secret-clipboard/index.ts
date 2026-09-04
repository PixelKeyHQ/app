import { requireNativeModule } from 'expo';

type SecretClipboard = {
  copy(text: string): Promise<void>;
};

export default requireNativeModule<SecretClipboard>('SecretClipboard');
