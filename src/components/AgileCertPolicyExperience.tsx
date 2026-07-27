import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { FileCheck2, ShieldCheck, X } from 'lucide-react';
import AgileCertFooter, { agileCertPolicyLinks } from './AgileCertFooter';

type PolicyId = (typeof agileCertPolicyLinks)[number][0];

interface PolicySection {
  title: string;
  paragraphs: string[];
  bullets?: string[];
}

interface PolicyRecord {
  id: PolicyId;
  title: string;
  summary: string;
  sections: PolicySection[];
}

const policies: PolicyRecord[] = [
  {
    id: 'privacy',
    title: 'Privacy Policy',
    summary: 'How AgileCert Global collects, uses, protects and retains candidate and platform information.',
    sections: [
      {
        title: 'Information we process',
        paragraphs: ['We process information needed to create and secure accounts, administer examinations, verify payments, issue results and credentials, provide support and operate candidate services.'],
        bullets: ['Account and contact information', 'Examination registration, attempts, results and integrity records', 'Payment, sponsorship, refund and credential transaction references', 'Support, preference and consent records', 'Technical security and service-delivery information'],
      },
      {
        title: 'How information is used',
        paragraphs: ['Information is used only for legitimate platform operations, candidate service delivery, security, verification, regulatory recordkeeping and approved communications. AgileCert Global does not sell candidate information to advertisers.'],
      },
      {
        title: 'Access, sharing and retention',
        paragraphs: ['Access is restricted by role and service need. Information may be handled by approved infrastructure, payment, email, verification and professional service providers under appropriate controls. Records are retained only for the period required for examination, financial, credential, security or legal purposes.'],
      },
      {
        title: 'Your choices',
        paragraphs: ['Candidates may review and update eligible profile details, manage optional email preferences, withdraw optional AI-processing consent and contact AgileCert Global about privacy or record concerns. Some examination, payment and credential records must remain available to protect institutional integrity.'],
      },
    ],
  },
  {
    id: 'terms',
    title: 'Terms of Use',
    summary: 'The conditions for accessing AgileCert Global accounts, examinations, services and digital resources.',
    sections: [
      {
        title: 'Account responsibility',
        paragraphs: ['You must provide accurate information, keep sign-in credentials private and promptly report suspected unauthorised access. Each candidate must use only their own account and identity.'],
      },
      {
        title: 'Permitted use',
        paragraphs: ['The platform may be used for legitimate registration, payment, preparation, assessment, certification and professional-profile activities.'],
        bullets: ['Do not share examination content or answer material', 'Do not bypass security, payment, eligibility or integrity controls', 'Do not interfere with the platform or another user’s records', 'Do not use automated tools to extract protected content'],
      },
      {
        title: 'Service availability and changes',
        paragraphs: ['AgileCert Global may maintain, improve, suspend or retire features to protect security, reliability and programme integrity. Material changes affecting candidates will be communicated through appropriate platform notices.'],
      },
      {
        title: 'Intellectual property and enforcement',
        paragraphs: ['Platform content, examination materials, templates, branding and credential designs remain protected. Breach of these terms may result in access restriction, assessment review, result cancellation or other proportionate action.'],
      },
    ],
  },
  {
    id: 'cookies',
    title: 'Cookie Policy',
    summary: 'How browser storage and similar technologies support secure portal operation.',
    sections: [
      {
        title: 'Essential browser storage',
        paragraphs: ['AgileCert Global uses essential cookies or browser storage to maintain secure sessions, remember necessary interface state, protect examination continuity and support payment or authentication returns.'],
      },
      {
        title: 'Optional measurement',
        paragraphs: ['Where optional analytics or service-improvement technologies are introduced, candidates will receive appropriate notice and available choices before non-essential tracking is used.'],
      },
      {
        title: 'Your controls',
        paragraphs: ['Browser settings can remove or block storage. Blocking essential storage may prevent sign-in, examination continuity, payment returns or other secured platform functions.'],
      },
    ],
  },
  {
    id: 'refunds',
    title: 'Refund Policy',
    summary: 'The principles governing examination, certificate and related service refund requests.',
    sections: [
      {
        title: 'Eligibility for review',
        paragraphs: ['Refund requests are assessed against the applicable product, payment status, access consumption, service-delivery state and any checkout terms displayed when payment was made. Submission of a request does not guarantee approval.'],
      },
      {
        title: 'Normally non-refundable situations',
        bullets: ['An examination has been started, submitted or completed', 'A certificate or credential has been issued or materially fulfilled', 'Access was used, transferred or consumed', 'A candidate missed a scheduled requirement without an approved exception', 'A result or access action arose from misconduct or policy breach'],
        paragraphs: [],
      },
      {
        title: 'Service failure and duplicate payment',
        paragraphs: ['Verified duplicate charges, failed fulfilment or material platform errors may qualify for correction, credit, rescheduling or refund after finance review.'],
      },
      {
        title: 'How to request a refund',
        paragraphs: ['Use the Sponsored Access & Refunds workspace or contact support with the order reference, amount, reason and supporting information. Approved refunds are returned through an authorised method and may be subject to provider processing time.'],
      },
    ],
  },
  {
    id: 'examinations',
    title: 'Examination & Assessment Policy',
    summary: 'The standards governing examination access, conduct, submission, grading and review.',
    sections: [
      {
        title: 'Access and readiness',
        paragraphs: ['Candidates must meet registration, payment or sponsorship, identity and technical requirements before starting an examination. Candidates are responsible for a suitable device, connection and interruption-free environment.'],
      },
      {
        title: 'Assessment integrity',
        bullets: ['Complete the assessment independently unless collaboration is expressly permitted', 'Do not copy, record, photograph, publish or distribute protected questions', 'Do not use unauthorised assistance, devices, accounts or software', 'Follow identity, webcam, browser and proctoring instructions where enabled'],
        paragraphs: [],
      },
      {
        title: 'Submission and results',
        paragraphs: ['Submitted answers are graded under the approved examination rules. Results may remain subject to integrity review, technical validation or authorised administrative correction.'],
      },
      {
        title: 'Review and appeal',
        paragraphs: ['A candidate may raise a documented concern through support within the applicable review period. Reviews address process, technical or administrative issues and do not disclose protected answer keys.'],
      },
    ],
  },
  {
    id: 'credentials',
    title: 'Certification & Credential Policy',
    summary: 'Eligibility, payment, issuance, verification and status rules for AgileCert credentials.',
    sections: [
      {
        title: 'Eligibility and separate fees',
        paragraphs: ['Passing an eligible examination may create a certificate offer. Examination fees and certificate or credential fees are separate unless a written offer, waiver or sponsorship states otherwise.'],
      },
      {
        title: 'Issuance and verification',
        paragraphs: ['A credential is issued only after required eligibility, integrity clearance, verified payment or authorised waiver and any applicable identity checks. Credential identifiers and verification records are controlled by AgileCert Global.'],
      },
      {
        title: 'Status, correction and withdrawal',
        paragraphs: ['Credentials may be corrected, suspended, expired, revoked or replaced where justified by administrative error, fraud, misconduct, payment reversal, expiry or policy requirements. Public verification reflects the current authoritative status.'],
      },
      {
        title: 'Sharing and renewal',
        paragraphs: ['Candidates must represent credentials accurately and use approved verification links. Renewal, continuing professional development or expiry requirements apply only where stated for the credential.'],
      },
    ],
  },
  {
    id: 'conduct',
    title: 'Candidate Code of Conduct',
    summary: 'The professional behaviour expected from every AgileCert Global candidate.',
    sections: [
      {
        title: 'Professional responsibility',
        bullets: ['Provide truthful registration, identity and professional information', 'Treat staff, candidates and support personnel respectfully', 'Protect confidential examination and credential information', 'Use sponsorship, refund and payment services honestly', 'Report security or integrity concerns responsibly'],
        paragraphs: [],
      },
      {
        title: 'Prohibited conduct',
        paragraphs: ['Impersonation, cheating, harassment, fraud, unauthorised access, content theft, credential misrepresentation and deliberate platform disruption are prohibited.'],
      },
      {
        title: 'Fair process',
        paragraphs: ['Potential breaches may be reviewed using relevant records. Actions will be proportionate to the evidence and may include warning, access restriction, examination invalidation, credential action or referral to an appropriate authority.'],
      },
    ],
  },
  {
    id: 'accessibility',
    title: 'Accessibility Statement',
    summary: 'AgileCert Global’s commitment to practical, inclusive access to candidate services.',
    sections: [
      {
        title: 'Our approach',
        paragraphs: ['AgileCert Global aims to provide clear navigation, readable content, keyboard-accessible controls, meaningful labels and responsive layouts across supported devices.'],
      },
      {
        title: 'Assessment accommodations',
        paragraphs: ['Candidates who require a reasonable assessment accommodation should contact support before the examination. Requests may require sufficient notice and appropriate documentation so that integrity and accessibility can be balanced.'],
      },
      {
        title: 'Report a barrier',
        paragraphs: ['Send the affected page, device or browser, the difficulty experienced and any preferred accommodation to training@iipmi.org. Accessibility feedback is reviewed as part of platform improvement.'],
      },
    ],
  },
  {
    id: 'data-consent',
    title: 'Data Protection & Consent Notice',
    summary: 'How mandatory processing, optional consent and candidate choices are separated.',
    sections: [
      {
        title: 'Required processing',
        paragraphs: ['Account security, examination administration, payment verification, result integrity, credential verification and legal or financial recordkeeping may require processing that cannot be switched off while the service is being provided.'],
      },
      {
        title: 'Optional consent',
        paragraphs: ['Optional communications, AI-assisted CV processing and future non-essential features use separate choices where applicable. Withdrawing optional consent does not invalidate completed examinations or authoritative records.'],
      },
      {
        title: 'Consent records and withdrawal',
        paragraphs: ['The platform may retain the date and scope of consent or withdrawal to demonstrate candidate choices. Available preferences can be changed in the relevant workspace or through support.'],
      },
    ],
  },
  {
    id: 'identity-proctoring',
    title: 'Identity Verification & Proctoring Notice',
    summary: 'What candidates should expect when identity or examination-integrity controls are required.',
    sections: [
      {
        title: 'Purpose',
        paragraphs: ['Identity verification and proctoring controls help confirm that the registered candidate completes the assessment and that results and credentials remain trustworthy.'],
      },
      {
        title: 'Possible information and signals',
        bullets: ['Identity document or verification status where required', 'Profile photograph or live capture where enabled', 'Webcam, browser-focus and examination-session events', 'Device, network and security signals relevant to integrity review'],
        paragraphs: [],
      },
      {
        title: 'Review and decisions',
        paragraphs: ['Automated signals do not by themselves establish misconduct. Flagged sessions may be reviewed by authorised personnel using proportionate evidence before result or credential action is taken.'],
      },
      {
        title: 'Candidate responsibility',
        paragraphs: ['Candidates must follow on-screen instructions, use their own identity and report technical problems promptly. Information is restricted to authorised integrity and support purposes.'],
      },
    ],
  },
];

const policyById = new Map(policies.map((policy) => [policy.id, policy]));

const policyFromHash = (): PolicyId | null => {
  const match = window.location.hash.match(/^#policy-(.+)$/);
  const id = match?.[1] as PolicyId | undefined;
  return id && policyById.has(id) ? id : null;
};

export default function AgileCertPolicyExperience() {
  const [activeId, setActiveId] = useState<PolicyId | null>(() => policyFromHash());
  const [authenticatedFooterRoot, setAuthenticatedFooterRoot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const syncHash = () => setActiveId(policyFromHash());
    window.addEventListener('hashchange', syncHash);
    return () => window.removeEventListener('hashchange', syncHash);
  }, []);

  useEffect(() => {
    const attach = () => {
      const footer = document.querySelector<HTMLElement>('footer:not([data-agilecert-footer="true"])');
      if (!footer) {
        setAuthenticatedFooterRoot(null);
        return;
      }
      let mount = footer.querySelector<HTMLElement>('[data-agilecert-policy-footer-mount="true"]');
      if (!mount) {
        mount = document.createElement('div');
        mount.dataset.agilecertPolicyFooterMount = 'true';
        mount.className = 'mt-4 border-t border-slate-200';
        footer.appendChild(mount);
      }
      setAuthenticatedFooterRoot(mount);
    };

    attach();
    const observer = new MutationObserver(attach);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  const activePolicy = useMemo(() => (activeId ? policyById.get(activeId) || null : null), [activeId]);

  const closePolicy = () => {
    history.replaceState(null, document.title, `${window.location.pathname}${window.location.search}`);
    setActiveId(null);
  };

  return (
    <>
      {authenticatedFooterRoot &&
        createPortal(<AgileCertFooter variant="light" compact />, authenticatedFooterRoot)}

      {activePolicy && (
        <div className="fixed inset-0 z-[260] overflow-y-auto bg-slate-950/75 p-3 backdrop-blur-sm md:p-6" role="dialog" aria-modal="true" aria-labelledby="agilecert-policy-title">
          <section className="mx-auto min-h-full max-w-6xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <header className="sticky top-0 z-20 flex items-start justify-between gap-4 border-b border-slate-800 bg-slate-950 px-5 py-5 text-white md:px-7">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-600">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">AgileCert Global Policy Centre</p>
                  <h1 id="agilecert-policy-title" className="mt-1 text-xl font-black md:text-2xl">{activePolicy.title}</h1>
                  <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-300">{activePolicy.summary}</p>
                </div>
              </div>
              <button type="button" onClick={closePolicy} className="rounded-xl border border-slate-700 p-2 text-slate-300 transition hover:bg-slate-800 hover:text-white" aria-label="Close policy centre">
                <X className="h-5 w-5" />
              </button>
            </header>

            <div className="grid lg:grid-cols-[280px_1fr]">
              <nav aria-label="Policy centre navigation" className="border-b border-slate-200 bg-slate-50 p-4 lg:border-b-0 lg:border-r lg:p-5">
                <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-1">
                  {policies.map((policy) => (
                    <a
                      key={policy.id}
                      href={`#policy-${policy.id}`}
                      className={`rounded-xl px-3 py-2.5 text-xs font-bold transition ${
                        policy.id === activePolicy.id
                          ? 'bg-slate-950 text-white shadow-sm'
                          : 'text-slate-600 hover:bg-white hover:text-emerald-700'
                      }`}
                    >
                      {policy.title}
                    </a>
                  ))}
                </div>
              </nav>

              <main className="space-y-7 p-5 md:p-8">
                <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-900">
                  <FileCheck2 className="mt-0.5 h-5 w-5 shrink-0" />
                  <p><strong>Effective July 2026.</strong> These policies form the baseline rules for the AgileCert Global portal. A programme, checkout or examination notice may provide additional terms for a specific service.</p>
                </div>

                {activePolicy.sections.map((section) => (
                  <section key={section.title}>
                    <h2 className="text-lg font-black text-slate-950">{section.title}</h2>
                    <div className="mt-3 space-y-3 text-sm leading-7 text-slate-600">
                      {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                      {section.bullets && (
                        <ul className="space-y-2 pl-5">
                          {section.bullets.map((item) => <li key={item} className="list-disc pl-1">{item}</li>)}
                        </ul>
                      )}
                    </div>
                  </section>
                ))}

                <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <h2 className="font-black text-slate-950">Questions or requests</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">Contact <a className="font-bold text-emerald-700 hover:underline" href="mailto:training@iipmi.org">training@iipmi.org</a> with the policy title, your candidate details where relevant and a clear description of the request.</p>
                </section>
              </main>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
