import { ExternalLink, Mail, ShieldCheck } from 'lucide-react';

export const agileCertPolicyLinks = [
  ['privacy', 'Privacy Policy'],
  ['terms', 'Terms of Use'],
  ['cookies', 'Cookie Policy'],
  ['refunds', 'Refund Policy'],
  ['examinations', 'Examination & Assessment Policy'],
  ['credentials', 'Certification & Credential Policy'],
  ['conduct', 'Candidate Code of Conduct'],
  ['accessibility', 'Accessibility Statement'],
  ['data-consent', 'Data Protection & Consent Notice'],
  ['identity-proctoring', 'Identity Verification & Proctoring Notice'],
] as const;

interface AgileCertFooterProps {
  variant?: 'dark' | 'light';
  compact?: boolean;
}

export default function AgileCertFooter({ variant = 'dark', compact = false }: AgileCertFooterProps) {
  const dark = variant === 'dark';
  const shellClass = dark
    ? 'border-t border-slate-800 bg-slate-950 text-slate-400'
    : 'border-t border-slate-200 bg-slate-100 text-slate-600';
  const headingClass = dark ? 'text-white' : 'text-slate-950';
  const linkClass = dark
    ? 'text-slate-400 transition hover:text-emerald-300'
    : 'text-slate-600 transition hover:text-emerald-700';

  if (compact) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 py-5 md:px-6">
        <nav aria-label="AgileCert policies" className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-[11px] font-bold">
          {agileCertPolicyLinks.slice(0, 8).map(([id, title]) => (
            <a key={id} href={`#policy-${id}`} className={linkClass}>
              {title}
            </a>
          ))}
        </nav>
        <p className="mt-3 text-center text-[11px]">
          © 2026 AgileCert Global. Powered by the Integrated Institute of Professional Management.
        </p>
      </div>
    );
  }

  return (
    <footer data-agilecert-footer="true" className={`${shellClass} py-12`}>
      <div className="mx-auto grid max-w-7xl gap-10 px-4 md:grid-cols-2 md:px-6 lg:grid-cols-[1.2fr_0.8fr_1.5fr]">
        <section>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className={`text-sm font-black uppercase tracking-[0.16em] ${headingClass}`}>AgileCert Global</p>
              <p className="text-xs">Focused professional examinations. Powered by IIPM.</p>
            </div>
          </div>
          <p className="mt-5 max-w-md text-xs leading-6">
            Secure candidate access, specialist examinations, verified results, certificate commerce and professional credential services in one connected platform.
          </p>
          <a href="mailto:training@iipmi.org" className={`mt-4 inline-flex items-center gap-2 text-xs font-bold ${linkClass}`}>
            <Mail className="h-4 w-4" /> training@iipmi.org
          </a>
        </section>

        <section>
          <h2 className={`text-xs font-black uppercase tracking-[0.16em] ${headingClass}`}>Candidate services</h2>
          <div className="mt-4 grid gap-3 text-xs font-semibold">
            <a href="#candidate-access" className={linkClass}>Candidate Access</a>
            <a href="#certifications" className={linkClass}>Specialist Examinations</a>
            <a href="https://iipmi.org" target="_blank" rel="noreferrer" className={`inline-flex items-center gap-1.5 ${linkClass}`}>
              IIPM Professional Programmes <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <a href="mailto:training@iipmi.org" className={linkClass}>Help & Support</a>
          </div>
        </section>

        <section>
          <h2 className={`text-xs font-black uppercase tracking-[0.16em] ${headingClass}`}>Policies and candidate standards</h2>
          <nav aria-label="AgileCert policies" className="mt-4 grid gap-x-6 gap-y-3 text-xs font-semibold sm:grid-cols-2">
            {agileCertPolicyLinks.map(([id, title]) => (
              <a key={id} href={`#policy-${id}`} className={linkClass}>
                {title}
              </a>
            ))}
          </nav>
        </section>
      </div>

      <div className={`mx-auto mt-10 max-w-7xl border-t px-4 pt-5 text-[11px] md:px-6 ${dark ? 'border-slate-800' : 'border-slate-200'}`}>
        © 2026 AgileCert Global. All rights reserved. Powered by the Integrated Institute of Professional Management.
      </div>
    </footer>
  );
}
