from pathlib import Path


def replace_once(path: str, old: str, new: str, label: str) -> None:
    file_path = Path(path)
    text = file_path.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one match in {path}, found {count}')
    file_path.write_text(text.replace(old, new, 1), encoding='utf-8')


replace_once(
    '.github/workflows/validate-agilecert-phase-3-completion.yml',
    """  pull_request:
    branches: [supabase-integration]
    paths:
      - 'docs/AGILECERT_PHASE_3_COMPLETION_SCOPE.md'
      - 'src/**'
      - 'package.json'
      - 'supabase/migrations/202607251800_phase_3_certificate_completion.sql'
      - '.github/workflows/validate-agilecert-phase-3-completion.yml'
""",
    """  pull_request:
    branches: [supabase-integration]
    paths:
      - 'docs/AGILECERT_PHASE_3_COMPLETION_SCOPE.md'
      - 'package.json'
      - 'src/components/AdminCertificateCompletionLauncher.tsx'
      - 'src/components/AdminCertificateCompletionPanel.tsx'
      - 'src/components/CandidateCertificateWorkspace.tsx'
      - 'src/main.tsx'
      - 'src/services/certificateCompletionService.ts'
      - 'src/services/certificatePdfService.ts'
      - 'src/services/certificateService.ts'
      - 'supabase/migrations/202607251800_phase_3_certificate_completion.sql'
      - '.github/workflows/validate-agilecert-phase-3-completion.yml'
""",
    'Phase 3 completion PR paths',
)

replace_once(
    '.github/workflows/validate-agilecert-phase-4.yml',
    """  pull_request:
    branches: [supabase-integration]
    paths:
      - 'src/**'
      - 'supabase/config.toml'
      - 'supabase/migrations/**'
      - 'supabase/functions/initialize-certificate-payment/**'
      - 'supabase/functions/verify-certificate-payment/**'
      - 'supabase/functions/paystack-certificate-webhook/**'
      - 'supabase/functions/_shared/agilecertCertificatePaystack.ts'
      - 'docs/AGILECERT_PHASE_4_SCOPE.md'
      - '.github/workflows/validate-agilecert-phase-4.yml'
""",
    """  pull_request:
    branches: [supabase-integration]
    paths:
      - 'docs/AGILECERT_PHASE_4_SCOPE.md'
      - 'src/components/AdminCertificateCommerceLauncher.tsx'
      - 'src/components/CandidateCertificateCommerce.tsx'
      - 'src/components/CertificatePaymentReturnHandler.tsx'
      - 'src/main.tsx'
      - 'src/services/certificateCommerceService.ts'
      - 'supabase/config.toml'
      - 'supabase/functions/_shared/agilecertCertificatePaystack.ts'
      - 'supabase/functions/initialize-certificate-payment/**'
      - 'supabase/functions/paystack-certificate-webhook/**'
      - 'supabase/functions/verify-certificate-payment/**'
      - 'supabase/migrations/202607240105_phase_4_certificate_payment_credential_issuance.sql'
      - '.github/workflows/validate-agilecert-phase-4.yml'
""",
    'Phase 4 PR paths',
)

phase3 = Path('.github/workflows/validate-agilecert-phase-3-completion.yml').read_text(encoding='utf-8')
phase4 = Path('.github/workflows/validate-agilecert-phase-4.yml').read_text(encoding='utf-8')

for required in [
    'src/components/CandidateCertificateWorkspace.tsx',
    'src/services/certificateCompletionService.ts',
    'src/components/CandidateCertificateCommerce.tsx',
    'src/services/certificateCommerceService.ts',
]:
    if required not in phase3 + phase4:
        raise SystemExit(f'Missing expected phase-specific path: {required}')

print('Phase-specific pull-request path filters narrowed successfully.')
