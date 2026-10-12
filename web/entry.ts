// Entry point bundled into web/offline.html by web/build.mjs.
// It reuses the app's own core modules so the offline page and the app
// produce byte-for-byte identical profiles from the same input.
import { profileLink, qrMatrix } from '../src/core/codec';
import { safeMessage } from '../src/core/errors';
import { manualErrors, manualProfile, type ManualFields } from '../src/core/input';
import { DEFAULT_MODEL, isOriginalModel, type Model, ORIGINAL_MODELS, SAVER_MODELS } from '../src/core/profile';

export const PixelKey = {
  ORIGINAL_MODELS,
  SAVER_MODELS,
  DEFAULT_MODEL,
  isOriginalModel,
  manualErrors,
  manualProfile,
  profileLink,
  qrMatrix,
  safeMessage,
};
export type { ManualFields, Model };

(globalThis as unknown as { PixelKey: typeof PixelKey }).PixelKey = PixelKey;
