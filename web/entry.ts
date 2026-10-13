// Entry point bundled into web/manual.html by web/build.mjs.
// It reuses the app's own core modules so the manual page and the app
// produce byte-for-byte identical profiles from the same input.
import { encodeProfile, profileLink, qrMatrix } from '../src/core/codec';
import { safeMessage } from '../src/core/errors';
import { manualErrors, manualProfile, parseAuthRequest, type ManualFields } from '../src/core/input';
import { DEFAULT_MODEL, isOriginalModel, maskedAccount, type Model, ORIGINAL_MODELS, profileModel, qrFits, SAVER_MODELS } from '../src/core/profile';

export const PixelKey = {
  ORIGINAL_MODELS,
  SAVER_MODELS,
  DEFAULT_MODEL,
  isOriginalModel,
  parseAuthRequest,
  manualErrors,
  manualProfile,
  encodeProfile,
  profileLink,
  profileModel,
  maskedAccount,
  qrFits,
  qrMatrix,
  safeMessage,
};
export type { ManualFields, Model };

(globalThis as unknown as { PixelKey: typeof PixelKey }).PixelKey = PixelKey;
