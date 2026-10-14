import type { ManualFields } from '../../src/core/input';
import type { Model } from '../../src/core/profile';

export type Output = {
  code: string;
  link: string;
  account: string;
  model: Model;
  quality: string;
  fits: boolean;
};
// `error` is empty when the user cancelled.
export type Reply<T> = { ok: true; value: T } | { ok: false; error: string };
export type DesktopAPI = {
  generate(fields: ManualFields, model: Model): Promise<Reply<Output>>;
  login(model: Model): Promise<Reply<Output>>;
  paste(): Promise<Reply<ManualFields>>;
  copy(): Promise<Reply<null>>;
  clear(): Promise<void>;
  touch(): void;
  onClear(listener: () => void): () => void;
};

declare global {
  interface Window { pixelkey: DesktopAPI }
}
