import { useEffect } from 'react';

const LEGACY_VIEW_TITLE = 'View Verifiable Certificate';
const LEGACY_DOWNLOAD_TITLE = 'Download Certificate PDF (jsPDF)';

const openSecureWorkspace = () => {
  window.dispatchEvent(new Event('agilecert-certificates-open'));
};

const replaceViewButton = (button: HTMLButtonElement) => {
  if (button.dataset.agilecertPhase3Gated === '1') return;

  const replacement = button.cloneNode(false) as HTMLButtonElement;
  replacement.dataset.agilecertPhase3Gated = '1';
  replacement.type = 'button';
  replacement.removeAttribute('title');
  replacement.textContent = 'Secure Certificate';
  replacement.className =
    'px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black rounded-lg transition shadow-sm border border-emerald-700/20 cursor-pointer';
  replacement.setAttribute('aria-label', 'Open the server-authorised certificate workspace');
  replacement.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    openSecureWorkspace();
  });
  button.replaceWith(replacement);
};

const replaceDownloadButton = (button: HTMLButtonElement) => {
  if (button.dataset.agilecertPhase3Gated === '1') return;

  const replacement = button.cloneNode(false) as HTMLButtonElement;
  replacement.dataset.agilecertPhase3Gated = '1';
  replacement.type = 'button';
  replacement.disabled = true;
  replacement.textContent = 'Server issuance required';
  replacement.className =
    'px-2.5 py-1.5 bg-slate-100 text-slate-400 text-[10px] font-bold rounded-lg border border-slate-200 cursor-not-allowed';
  replacement.setAttribute(
    'title',
    'Legacy browser-generated PDFs are disabled. Use the server-authorised certificate workspace after administrator issuance.',
  );
  button.replaceWith(replacement);
};

const applyGate = () => {
  const dashboard = document.getElementById('student-dashboard');
  if (!dashboard) return;

  dashboard
    .querySelectorAll<HTMLButtonElement>(`button[title="${LEGACY_VIEW_TITLE}"]`)
    .forEach(replaceViewButton);

  dashboard
    .querySelectorAll<HTMLButtonElement>(`button[title="${LEGACY_DOWNLOAD_TITLE}"]`)
    .forEach(replaceDownloadButton);
};

/**
 * Compatibility boundary for the original gradebook.
 *
 * The original dashboard created a certificate entirely in the browser from a
 * score object. Phase 3 removes those event handlers by replacing the legacy
 * buttons. Only the server-owned eligibility and issuance workflow can now
 * produce an active, publicly verifiable certificate record.
 */
export default function LegacyCertificateSecurityGate() {
  useEffect(() => {
    let scheduled = false;

    const scheduleApply = () => {
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(() => {
        scheduled = false;
        applyGate();
      });
    };

    scheduleApply();
    const observer = new MutationObserver(scheduleApply);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  return null;
}
