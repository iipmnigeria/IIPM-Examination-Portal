import { CIPMN_PRINT_PNG_CHUNK_1 } from './cipmnCertificatePrint/cipmn1';
import { CIPMN_PRINT_PNG_CHUNK_2 } from './cipmnCertificatePrint/cipmn2';
import { CIPMN_PRINT_PNG_CHUNK_3 } from './cipmnCertificatePrint/cipmn3';
import { CIPMN_PRINT_PNG_CHUNK_4 } from './cipmnCertificatePrint/cipmn4';
import { CIPMN_PRINT_PNG_CHUNK_5 } from './cipmnCertificatePrint/cipmn5';
import { CIPMN_PRINT_PNG_CHUNK_6 } from './cipmnCertificatePrint/cipmn6';

export const CIPMN_CERTIFICATE_LOGO_DATA_URI =
  'data:image/png;base64,' +
  CIPMN_PRINT_PNG_CHUNK_1 +
  CIPMN_PRINT_PNG_CHUNK_2 +
  CIPMN_PRINT_PNG_CHUNK_3 +
  CIPMN_PRINT_PNG_CHUNK_4 +
  CIPMN_PRINT_PNG_CHUNK_5 +
  CIPMN_PRINT_PNG_CHUNK_6;
