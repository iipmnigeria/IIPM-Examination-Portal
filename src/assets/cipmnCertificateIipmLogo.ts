import { IIPM_PRINT_PNG_CHUNK_1 } from './cipmnCertificatePrint/iipm1';
import { IIPM_PRINT_PNG_CHUNK_2 } from './cipmnCertificatePrint/iipm2';
import { IIPM_PRINT_PNG_CHUNK_3 } from './cipmnCertificatePrint/iipm3';
import { IIPM_PRINT_PNG_CHUNK_4 } from './cipmnCertificatePrint/iipm4';
import { IIPM_PRINT_PNG_CHUNK_5 } from './cipmnCertificatePrint/iipm5';
import { IIPM_PRINT_PNG_CHUNK_6 } from './cipmnCertificatePrint/iipm6';
import { IIPM_PRINT_PNG_CHUNK_7 } from './cipmnCertificatePrint/iipm7';

export const IIPM_CERTIFICATE_LOGO_DATA_URI =
  'data:image/png;base64,' +
  IIPM_PRINT_PNG_CHUNK_1 +
  IIPM_PRINT_PNG_CHUNK_2 +
  IIPM_PRINT_PNG_CHUNK_3 +
  IIPM_PRINT_PNG_CHUNK_4 +
  IIPM_PRINT_PNG_CHUNK_5 +
  IIPM_PRINT_PNG_CHUNK_6 +
  IIPM_PRINT_PNG_CHUNK_7;
