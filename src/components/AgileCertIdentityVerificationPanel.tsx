import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileCheck2,
  IdCard,
  Loader2,
  ShieldCheck,
  Upload,
  X,
} from 'lucide-react';
import { getMyAgileCertProfile } from '../services/agileCertService';
import {
  getMyAgileCertIdentityRequest,
  submitAgileCertIdentityVerification,
  type AgileCertIdentityDocumentType,
  type AgileCertIdentityRequest,
} from '../services/identityVerificationService';

type IdentityState = 'unverified' | 'pending' | 'verified' | 'rejected' | 'expired';

const documentOptions: Array<{ value: AgileCertIdentityDocumentType; label: string }> = [
  { value: 'passport', label: 'International Passport' },
  { value: 'national_id', label: 'National Identity Card' },
  { value: 'drivers_licence', label: "Driver's Licence" },
  { value: 'voters_card', label: "Voter's Card" },
  { value: 'residence_permit', label: 'Residence Permit' },
  { value: 'other_government_id', label: 'Other Government-issued ID' },
];

function requestState(request: AgileCertIdentityRequest | null, profileStatus?: string | null): IdentityState {
  if (profileStatus === 'verified' || request?.status === 'verified') return 'verified';
  if (request?.status === 'rejected' || profileStatus === 'rejected') return 'rejected';
  if (request?.status === 'expired' || profileStatus === 'expired') return 'expired';
  if (request && ['draft', 'submitted', 'processing'].includes(request.status)) return 'pending';
  if (profileStatus === 'pending') return 'pending';
  return 'unverified';
}

function statusLabel(status: IdentityState): string {
  if (status === 'verified') return 'Identity Verified';
  if (status === 'pending') return 'Identity Verification Pending';
  if (status === 'rejected') return 'Retry Identity Verification';
  if (status === 'expired') return 'Renew Identity Verification';
  return 'Verify Identity for Professional Certificate';
}

export default function AgileCertIdentityVerificationPanel() {
  const [isCandidate, setIsCandidate] = useState(
    () => localStorage.getItem('aura_logged_role') === 'student',
  );
  const [isOpen, setIsOpen] = useState(false);
  const [profileStatus, setProfileStatus] = useState<string | null>(null);
  const [profileCountry, setProfileCountry] = useState('');
  const [identityRequest, setIdentityRequest] = useState<AgileCertIdentityRequest | null>(null);
  const [documentType, setDocumentType] = useState<AgileCertIdentityDocumentType>('passport');
  const [issuingCountryCode, setIssuingCountryCode] = useState('');
  const [documentNumberLast4, setDocumentNumberLast4] = useState('');
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const status = useMemo(
    () => requestState(identityRequest, profileStatus),
    [identityRequest, profileStatus],
  );

  const loadStatus = async () => {
    if (localStorage.getItem('aura_logged_role') !== 'student') return;

    try {
      setIsLoading(true);
      const [profile, request] = await Promise.all([
        getMyAgileCertProfile(),
        getMyAgileCertIdentityRequest(),
      ]);
      setProfileStatus(profile?.identity_verification_status || null);
      setProfileCountry(profile?.country_code || '');
      setIssuingCountryCode((current) => current || profile?.country_code || '');
      setIdentityRequest(request);
    } catch (loadError) {
      console.error('Unable to load AgileCert identity status:', loadError);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const checkRole = () => {
      const candidate = localStorage.getItem('aura_logged_role') === 'student';
      setIsCandidate(candidate);
      if (!candidate) setIsOpen(false);
    };

    checkRole();
    void loadStatus();
    const interval = window.setInterval(checkRole, 1_000);
    window.addEventListener('storage', checkRole);
    window.addEventListener('agilecert-identity-refresh', loadStatus);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('storage', checkRole);
      window.removeEventListener('agilecert-identity-refresh', loadStatus);
    };
  }, []);

  const handleSubmit = async () => {
    const country = issuingCountryCode.trim().toUpperCase();
    const last4 = documentNumberLast4.trim().toUpperCase();

    if (!/^[A-Z]{2}$/.test(country)) {
      setError('Enter the two-letter issuing-country code, such as NG, GH, GB, US or CA.');
      return;
    }
    if (last4 && !/^[A-Z0-9]{2,4}$/.test(last4)) {
      setError('Enter only the final two to four characters of the document number.');
      return;
    }
    if (!documentFile || !selfieFile) {
      setError('Upload both the government identity document and a current identity selfie.');
      return;
    }
    if (documentFile.size > 15 * 1024 * 1024 || selfieFile.size > 15 * 1024 * 1024) {
      setError('Each identity file must be no larger than 15 MB.');
      return;
    }
    if (!selfieFile.type.startsWith('image/')) {
      setError('The identity selfie must be a JPG, PNG or WEBP image.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');
      setMessage('');
      const result = await submitAgileCertIdentityVerification({
        documentType,
        issuingCountryCode: country,
        documentNumberLast4: last4,
        documentFile,
        selfieFile,
      });
      setMessage(result.message);
      setDocumentFile(null);
      setSelfieFile(null);
      await loadStatus();
    } catch (submitError: any) {
      setError(submitError?.message || 'Identity verification could not be submitted.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isCandidate) return null;

  const pending = status === 'pending';
  const verified = status === 'verified';

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setIsOpen(true);
          setError('');
          setMessage('');
          void loadStatus();
        }}
        className={`fixed bottom-5 left-5 z-[90] inline-flex max-w-[calc(100vw-2.5rem)] items-center gap-2 rounded-full border px-4 py-3 text-xs font-black shadow-2xl transition md:text-sm ${
          verified
            ? 'border-emerald-300 bg-emerald-600 text-white hover:bg-emerald-700'
            : pending
              ? 'border-amber-300 bg-amber-100 text-amber-900 hover:bg-amber-200'
              : 'border-slate-700 bg-slate-950 text-white hover:bg-slate-800'
        }`}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : verified ? (
          <CheckCircle2 className="h-4 w-4" />
        ) : pending ? (
          <FileCheck2 className="h-4 w-4" />
        ) : (
          <IdCard className="h-4 w-4 text-emerald-400" />
        )}
        {statusLabel(status)}
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center overflow-y-auto bg-slate-950/80 p-4 backdrop-blur-sm">
          <section className="my-6 w-full max-w-2xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
            <header className="flex items-center justify-between bg-slate-950 px-6 py-5 text-white">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-400">AgileCert Global</p>
                <h2 className="mt-1 text-xl font-black">Professional Identity Verification</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-full border border-slate-700 p-2 text-slate-300 hover:bg-slate-800 hover:text-white"
                aria-label="Close identity verification"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="space-y-5 p-6">
              <div className={`rounded-2xl border p-4 ${
                verified
                  ? 'border-emerald-200 bg-emerald-50'
                  : pending
                    ? 'border-amber-200 bg-amber-50'
                    : status === 'rejected'
                      ? 'border-rose-200 bg-rose-50'
                      : 'border-slate-200 bg-slate-50'
              }`}>
                <div className="flex items-start gap-3">
                  {verified ? (
                    <ShieldCheck className="mt-0.5 h-6 w-6 text-emerald-700" />
                  ) : status === 'rejected' ? (
                    <AlertTriangle className="mt-0.5 h-6 w-6 text-rose-700" />
                  ) : (
                    <IdCard className="mt-0.5 h-6 w-6 text-slate-700" />
                  )}
                  <div>
                    <p className="font-black text-slate-950">{statusLabel(status)}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      {verified
                        ? `Identity is verified${identityRequest?.expires_at ? ` until ${new Date(identityRequest.expires_at).toLocaleDateString()}` : ''}. Professional Certificate checkout is enabled.`
                        : pending
                          ? 'Your secure documents have been received. Automated verification or exception review is in progress.'
                          : status === 'rejected'
                            ? identityRequest?.rejection_reason || 'The previous verification could not be approved. Submit clearer or corrected files.'
                            : 'Government-issued identity verification is required only for the higher-assurance Professional Certificate.'}
                    </p>
                  </div>
                </div>
              </div>

              {!verified && !pending && (
                <>
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="space-y-1.5 text-sm font-bold text-slate-700">
                      Government ID type
                      <select
                        value={documentType}
                        onChange={(event) => setDocumentType(event.target.value as AgileCertIdentityDocumentType)}
                        className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      >
                        {documentOptions.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </label>

                    <label className="space-y-1.5 text-sm font-bold text-slate-700">
                      Issuing country code
                      <input
                        value={issuingCountryCode || profileCountry}
                        onChange={(event) => setIssuingCountryCode(event.target.value.toUpperCase().slice(0, 2))}
                        maxLength={2}
                        placeholder="NG"
                        className="w-full rounded-xl border border-slate-300 px-4 py-3 uppercase outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      />
                    </label>

                    <label className="space-y-1.5 text-sm font-bold text-slate-700 md:col-span-2">
                      Final 2–4 characters of document number
                      <input
                        value={documentNumberLast4}
                        onChange={(event) => setDocumentNumberLast4(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4))}
                        maxLength={4}
                        placeholder="1234"
                        className="w-full rounded-xl border border-slate-300 px-4 py-3 uppercase outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      />
                      <span className="block text-[11px] font-medium text-slate-400">Do not enter the complete document number.</span>
                    </label>

                    <label className="space-y-2 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm font-bold text-slate-700">
                      <span className="flex items-center gap-2"><Upload className="h-4 w-4 text-emerald-600" /> Government ID file</span>
                      <input
                        type="file"
                        accept="application/pdf,image/jpeg,image/png,image/webp"
                        onChange={(event) => setDocumentFile(event.target.files?.[0] || null)}
                        className="block w-full text-xs font-medium text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:font-bold file:text-white"
                      />
                      {documentFile && <span className="text-xs text-emerald-700">{documentFile.name}</span>}
                    </label>

                    <label className="space-y-2 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm font-bold text-slate-700">
                      <span className="flex items-center gap-2"><Upload className="h-4 w-4 text-emerald-600" /> Current identity selfie</span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        capture="user"
                        onChange={(event) => setSelfieFile(event.target.files?.[0] || null)}
                        className="block w-full text-xs font-medium text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:font-bold file:text-white"
                      />
                      {selfieFile && <span className="text-xs text-emerald-700">{selfieFile.name}</span>}
                    </label>
                  </div>

                  <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs leading-5 text-blue-800">
                    Documents are stored in a private bucket. Temporary provider links expire quickly. Verification also locks the appropriate NGN or USD pricing market using the issuing country.
                  </div>

                  <button
                    type="button"
                    onClick={() => void handleSubmit()}
                    disabled={isSubmitting}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                    Submit Secure Identity Verification
                  </button>
                </>
              )}

              {error && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div>
              )}
              {message && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{message}</div>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
