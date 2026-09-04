import { requireOptionalNativeModule } from 'expo';

type Autofill = {
  cancel(): Promise<void>;
};

export default requireOptionalNativeModule<Autofill>('Autofill');
