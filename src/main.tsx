import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
const AdminAssignmentWidget = lazy(() => import('./components/AdminAssignmentWidget'));
const AdminCertificateCommerceLauncher = lazy(() => import('./components/AdminCertificateCommerceLauncher'));
const AdminCertificateManagementLauncher = lazy(() => import('./components/AdminCertificateManagementLauncher'));
const AdminCertificateCompletionLauncher = lazy(() => import('./components/AdminCertificateCompletionLauncher'));
const AdminCommerceConsole = lazy(() => import('./components/AdminCommerceConsole'));
const AdminCommunicationsLauncher = lazy(() => import('./components/AdminCommunicationsLauncher'));
const AdminCredentialLifecycleLauncher = lazy(() => import('./components/AdminCredentialLifecycleLauncher'));
const AdminFinanceSponsorshipLauncher = lazy(() => import('./components/AdminFinanceSponsorshipLauncher'));
const AdminIdentityAssuranceLauncher = lazy(() => import('./components/AdminIdentityAssuranceLauncher'));
const AdminIdentityProctoringLauncher = lazy(() => import('./components/AdminIdentityProctoringLauncher'));
const AdminMaterialManagementLauncher = lazy(() => import('./components/AdminMaterialManagementLauncher'));
const AdminPeopleMessagingLauncher = lazy(() => import('./components/AdminPeopleMessagingLauncher'));
const AdminPrimaryToolsMenu = lazy(() => import('./components/AdminPrimaryToolsMenu'));
const AdminVideoLearningAnalyticsLauncher = lazy(() => import('./components/AdminVideoLearningAnalyticsLauncher'));
const AgileCertPolicyExperience = lazy(() => import('./components/AgileCertPolicyExperience'));
import AgileProgrammeCatalogue from './components/AgileProgrammeCatalogue';
const AiCertificationAdviser = lazy(() => import('./components/AiCertificationAdviser'));
const AiCvEnhancementLauncher = lazy(() => import('./components/AiCvEnhancementLauncher'));
const CandidateCertificateCommerce = lazy(() => import('./components/CandidateCertificateCommerce'));
const CandidateCertificateWorkspace = lazy(() => import('./components/CandidateCertificateWorkspace'));
const CandidateCipmnModuleCart = lazy(() => import('./components/CandidateCipmnModuleCart'));
const CandidateCipmnRemediationWorkspace = lazy(() => import('./components/CandidateCipmnRemediationWorkspace'));
const CandidateCommerceOverlay = lazy(() => import('./components/CandidateCommerceOverlay'));
const CandidateCommunicationPreferences = lazy(() => import('./components/CandidateCommunicationPreferences'));
const CandidateCredentialWallet = lazy(() => import('./components/CandidateCredentialWallet'));
const CandidateIdentityAssurance = lazy(() => import('./components/CandidateIdentityAssurance'));
const CandidateIdentityProctoringWorkspace = lazy(() => import('./components/CandidateIdentityProctoringWorkspace'));
import CandidateOnboardingBoundary from './components/CandidateOnboardingBoundary';
const CandidatePrimaryToolsMenu = lazy(() => import('./components/CandidatePrimaryToolsMenu'));
const CandidateSponsoredAccessWorkspace = lazy(() => import('./components/CandidateSponsoredAccessWorkspace'));
const CandidateVideoLearningProgressLauncher = lazy(() => import('./components/CandidateVideoLearningProgressLauncher'));
const CertificatePaymentReturnHandler = lazy(() => import('./components/CertificatePaymentReturnHandler'));
const CipmnModuleMaterialsMount = lazy(() => import('./components/CipmnModuleMaterialsMount'));
const LegacyCertificateSecurityGate = lazy(() => import('./components/LegacyCertificateSecurityGate'));
const PaymentReturnHandler = lazy(() => import('./components/PaymentReturnHandler'));
const PublicCertificateVerification = lazy(() => import('./components/PublicCertificateVerification'));
import SupabaseSessionBoundary from './components/SupabaseSessionBoundary';
import './index.css';

const createMemoryStorage = (): Storage => {
  const values = new Map<string, string>();

  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => Array.from(values.keys())[index] ?? null,
    removeItem: (key: string) => values.delete(key),
    setItem: (key: string, value: string) => values.set(key, String(value)),
  };
};

const ensureUsableBrowserStorage = () => {
  const testKey = '__iipm_storage_test__';

  try {
    window.localStorage.setItem(testKey, '1');
    window.localStorage.removeItem(testKey);
    return;
  } catch (storageError) {
    console.warn('Browser storage is unavailable; using temporary in-memory storage.', storageError);
  }

  try {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: createMemoryStorage(),
    });
  } catch (replacementError) {
    console.error('Unable to install temporary browser storage:', replacementError);
  }
};

ensureUsableBrowserStorage();

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('The AgileCert Global portal root element was not found.');
}

const diagnosticOverlay = document.createElement('div');
diagnosticOverlay.id = 'iipm-startup-diagnostic';
diagnosticOverlay.setAttribute('role', 'alert');
diagnosticOverlay.style.display = 'none';
diagnosticOverlay.style.position = 'fixed';
diagnosticOverlay.style.inset = '0';
diagnosticOverlay.style.zIndex = '2147483647';
diagnosticOverlay.style.overflow = 'auto';
diagnosticOverlay.style.padding = '24px';
diagnosticOverlay.style.background = '#f8fafc';
diagnosticOverlay.style.color = '#0f172a';
diagnosticOverlay.style.fontFamily = 'Arial, sans-serif';
document.body.append(diagnosticOverlay);

const normaliseErrorMessage = (value: unknown): string => {
  if (value instanceof Error) return value.message;
  if (typeof value === 'string' && value.trim()) return value;
  return 'An unexpected application error occurred.';
};

const showStartupError = (value: unknown) => {
  const message = normaliseErrorMessage(value);
  console.error('AgileCert Global portal startup error:', value);

  diagnosticOverlay.replaceChildren();
  diagnosticOverlay.style.display = 'grid';
  diagnosticOverlay.style.placeItems = 'center';

  const panel = document.createElement('section');
  panel.style.width = '100%';
  panel.style.maxWidth = '640px';
  panel.style.padding = '28px';
  panel.style.borderRadius = '16px';
  panel.style.background = '#ffffff';
  panel.style.border = '1px solid #e2e8f0';
  panel.style.boxShadow = '0 18px 50px rgba(15, 23, 42, 0.12)';

  const heading = document.createElement('h1');
  heading.textContent = 'AgileCert Global';
  heading.style.margin = '0 0 12px';
  heading.style.fontSize = '24px';

  const instruction = document.createElement('p');
  instruction.textContent =
    'The portal could not complete startup. Reload the page once. If this panel remains, send a screenshot of the diagnostic message to the portal administrator.';
  instruction.style.margin = '0 0 12px';
  instruction.style.lineHeight = '1.6';

  const diagnostic = document.createElement('code');
  diagnostic.textContent = message;
  diagnostic.style.display = 'block';
  diagnostic.style.padding = '12px';
  diagnostic.style.borderRadius = '8px';
  diagnostic.style.background = '#f1f5f9';
  diagnostic.style.color = '#be123c';
  diagnostic.style.overflowWrap = 'anywhere';

  const reloadButton = document.createElement('button');
  reloadButton.type = 'button';
  reloadButton.textContent = 'Reload Portal';
  reloadButton.style.marginTop = '16px';
  reloadButton.style.padding = '10px 16px';
  reloadButton.style.border = '0';
  reloadButton.style.borderRadius = '10px';
  reloadButton.style.background = '#059669';
  reloadButton.style.color = '#ffffff';
  reloadButton.style.fontWeight = '700';
  reloadButton.style.cursor = 'pointer';
  reloadButton.addEventListener('click', () => window.location.reload());

  panel.append(heading, instruction, diagnostic, reloadButton);
  diagnosticOverlay.append(panel);
};

window.addEventListener('error', (event) => {
  showStartupError(event.error || event.message);
});

window.addEventListener('unhandledrejection', (event) => {
  showStartupError(event.reason);
});

createRoot(rootElement).render(
  <StrictMode>
    <AgileProgrammeCatalogue />
    <SupabaseSessionBoundary>
      <CandidateOnboardingBoundary>
        <App />
        <Suspense fallback={null}>
        <CandidatePrimaryToolsMenu />
        <CandidateCipmnModuleCart />
        <CipmnModuleMaterialsMount />
        <AdminPrimaryToolsMenu />
        <AgileCertPolicyExperience />
        <CandidateCommerceOverlay />
        <PaymentReturnHandler />
        <AdminCommerceConsole />
        <AdminAssignmentWidget />
        <AdminMaterialManagementLauncher />
        <CandidateCertificateWorkspace />
        <LegacyCertificateSecurityGate />
        <AdminCertificateManagementLauncher />
        <AdminCertificateCompletionLauncher />
        <PublicCertificateVerification />
        <CandidateIdentityAssurance />
        <CandidateIdentityProctoringWorkspace />
        <CandidateCertificateCommerce />
        <CandidateCredentialWallet />
        <CandidateSponsoredAccessWorkspace />
        <CandidateCommunicationPreferences />
        <CandidateCipmnRemediationWorkspace />
        <CandidateVideoLearningProgressLauncher />
        <CertificatePaymentReturnHandler />
        <AdminIdentityAssuranceLauncher />
        <AdminIdentityProctoringLauncher />
        <AdminCertificateCommerceLauncher />
        <AdminCredentialLifecycleLauncher />
        <AdminFinanceSponsorshipLauncher />
        <AdminCommunicationsLauncher />
        <AdminPeopleMessagingLauncher />
        <AdminVideoLearningAnalyticsLauncher />
        <AiCvEnhancementLauncher />
        <AiCertificationAdviser />
        </Suspense>
      </CandidateOnboardingBoundary>
    </SupabaseSessionBoundary>
  </StrictMode>,
);
