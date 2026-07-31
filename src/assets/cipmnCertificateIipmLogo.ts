import { IIPM_PNG_CHUNK_1 } from './cipmnCertificateLossless/iipm1';
import { IIPM_PNG_CHUNK_2 } from './cipmnCertificateLossless/iipm2';
import { IIPM_PNG_CHUNK_3 } from './cipmnCertificateLossless/iipm3';
import { IIPM_PNG_CHUNK_4 } from './cipmnCertificateLossless/iipm4';
import { IIPM_PNG_CHUNK_5 } from './cipmnCertificateLossless/iipm5';
import { IIPM_PNG_CHUNK_6 } from './cipmnCertificateLossless/iipm6';

export const IIPM_CERTIFICATE_LOGO_DATA_URI =
  'data:image/png;base64,' +
  IIPM_PNG_CHUNK_1 +
  IIPM_PNG_CHUNK_2 +
  IIPM_PNG_CHUNK_3 +
  IIPM_PNG_CHUNK_4 +
  IIPM_PNG_CHUNK_5 +
  IIPM_PNG_CHUNK_6;
