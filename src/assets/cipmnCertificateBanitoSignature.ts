import { SIGNATURE_PRINT_PNG_CHUNK_1 } from './cipmnCertificatePrint/signature1';
import { SIGNATURE_PRINT_PNG_CHUNK_2 } from './cipmnCertificatePrint/signature2';
import { SIGNATURE_PRINT_PNG_CHUNK_3 } from './cipmnCertificatePrint/signature3';
import { SIGNATURE_PRINT_PNG_CHUNK_4 } from './cipmnCertificatePrint/signature4';

export const BANITO_SIGNATURE_DATA_URI =
  'data:image/png;base64,' +
  SIGNATURE_PRINT_PNG_CHUNK_1 +
  SIGNATURE_PRINT_PNG_CHUNK_2 +
  SIGNATURE_PRINT_PNG_CHUNK_3 +
  SIGNATURE_PRINT_PNG_CHUNK_4;
