import { useEffect } from 'react';

const LEGACY_VIEW_TITLE = 'View Verifiable Certificate';
const LEGACY_DOWNLOAD_TITLE = 'Download Certificate PDF (jsPDF)';

function replaceLegacyButton(button: HTMLButtonElement, mode: 'offer' | 'locked') {
  if (button.dataset.agilecertCertificateGated === '1') return;

  const replacement = button.cloneNode(true) as HTMLButtonElement;
  replacement.dataset.agilecertCertificateGated = '1';
  replacement.removeAttribute('title');
  replacement.replaceChildren();

  if (mode === 'offer') {
    replacement.textContent = 'Certificate Options';
    replacement.className =
      'px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black rounded-lg transition shadow-sm border border-emerald-700/20 cursor-pointer';
    replacement.type = 'button';
    replacement.disabled = false;
    replacement.setAttribute('aria-label', 'View certificate purchase options');
    replacement.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      window.dispatchEvent(new Event('agilecert-offers-refresh'));
    });
  } else {
    replacement.textContent = 'Purchase Required';
    replacement.className =
      'px-3 py-1.5 bg-slate-100 text-slate-400 text-[11px] font-bold rounded-lg border border-slate-200 cursor-not-allowed';
    replacement.type = 'button';
    replacement.disabled = true;
    replacement.setAttribute(
      'title',
      'Certificate and digital badge access is available after verified certificate payment.',
    );
  }

  button.replaceWith(replacement);
}

function applyCertificateGate() {
  const dashboard = document.getElementById('student-dashboard');
  if (!dashboard) return;

  dashboard
    .querySelectorAll<HTMLButtonElement>(`button[title="${LEGACY_VIEW_TITLE}"]`)
    .forEach((button) => replaceLegacyButton(button, 'offer'));

  dashboard
    .querySelectorAll<HTMLButtonElement>(`button[title="${LEGACY_DOWNLOAD_TITLE}"]`)
    .forEach((button) => replaceLegacyButton(button, 'locked'));
}

/**
 * Temporary compatibility gate for the original candidate gradebook.
 *
 * The legacy dashboard generated a certificate directly in the browser after
 * a passing score. Until that large dashboard is fully refactored, this
 * component removes those event handlers by replacing the buttons with safe
 * controls that route candidates to the server-authorised AgileCert offer.
 */
export default function AgileCertLegacyCertificateGate() {
  useEffect(() => {
    let scheduled = false;

    const scheduleApply = () => {
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(() => {
        scheduled = false;
        applyCertificateGate();
      });
    };

    scheduleApply();
    const observer = new MutationObserver(scheduleApply);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  return null;
}
