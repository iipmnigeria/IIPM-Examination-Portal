export const AGILECERT_BRAND = {
  name: 'AgileCert Global',
  endorsement: 'Powered by IIPM',
  legalEntity: 'Integrated Institute of Professional Management',
  checkoutTradingName: 'AgileCert Global by IIPM',
  descriptor: 'Independent Examinations and Verifiable Specialist Credentials',
  positioning:
    'Independent professional competency examinations, preparation resources and verifiable specialist credentials for candidates worldwide.',
  independenceDisclosure:
    'AgileCert Global credentials are independently developed and issued by AgileCert Global, powered by IIPM. References to external standards, frameworks or certification organisations are for educational and competency-mapping purposes only and do not imply affiliation, authorisation, endorsement or equivalence.',
  examinationFeeDisclosure:
    'The examination fee covers examination access and downloadable preparation materials. Certificate issuance is optional and attracts a separate fee after the candidate meets the required pass mark.',
  earlyPriceWindowDays: 7,
} as const;

export const AGILECERT_LINKS = {
  iipmMainSite: 'https://iipmi.org',
  currentPortal: 'https://iipmnigeria.github.io/IIPM-Examination-Portal/',
} as const;

export type AgileCertCertificateProductCode = 'achievement' | 'professional';
export type AgileCertCurrency = 'NGN' | 'USD';
