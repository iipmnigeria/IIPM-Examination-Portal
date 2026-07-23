import { useEffect } from 'react';
import { getMyAgileCertCredentials, type AgileCertCredential } from '../services/agileCertService';
import {
  downloadAgileCertCredentialAsset,
  type AgileCertCredentialAssetType,
} from '../services/credentialAssetService';

function credentialCodeFromCard(card: HTMLElement): string {
  const paragraphs = Array.from(card.querySelectorAll('p'));
  const idLine = paragraphs.find((paragraph) =>
    paragraph.textContent?.trim().startsWith('Credential ID:'),
  );
  return idLine?.textContent?.replace(/^Credential ID:\s*/i, '').trim() || '';
}

function createDownloadButton(
  credential: AgileCertCredential,
  assetType: AgileCertCredentialAssetType,
  label: string,
): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.agilecertAssetType = assetType;
  button.className =
    'inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-black text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60';
  button.textContent = label;

  button.addEventListener('click', async () => {
    const originalLabel = button.textContent || label;
    button.disabled = true;
    button.textContent = 'Preparing...';

    try {
      await downloadAgileCertCredentialAsset({
        credentialId: credential.id,
        assetType,
      });
      button.textContent = 'Download started';
      window.setTimeout(() => {
        button.textContent = originalLabel;
        button.disabled = false;
      }, 1_500);
    } catch (error: any) {
      button.textContent = error?.message || 'Download failed';
      window.setTimeout(() => {
        button.textContent = originalLabel;
        button.disabled = false;
      }, 4_000);
    }
  });

  return button;
}

function enhanceCredentialCards(credentials: AgileCertCredential[]) {
  const credentialByCode = new Map(
    credentials.map((credential) => [credential.credential_code, credential]),
  );

  document.querySelectorAll<HTMLElement>('article').forEach((card) => {
    const credentialCode = credentialCodeFromCard(card);
    const credential = credentialByCode.get(credentialCode);
    if (!credential) return;

    const actions = Array.from(card.querySelectorAll<HTMLElement>('div')).find((element) =>
      element.className.includes('flex-wrap') &&
      element.querySelector('a[href*="verify="]'),
    );
    if (!actions) return;

    if (!actions.querySelector('[data-agilecert-asset-type="certificate"]')) {
      actions.prepend(
        createDownloadButton(credential, 'certificate', 'Download Certificate'),
      );
    }

    if (
      credential.product_code === 'professional' &&
      !actions.querySelector('[data-agilecert-asset-type="transcript"]')
    ) {
      actions.append(
        createDownloadButton(credential, 'transcript', 'Download Transcript'),
      );
    }
  });
}

/**
 * Adds secure download controls to the AgileCert credential cards while the
 * candidate workspace remains independently mounted from the legacy dashboard.
 */
export default function AgileCertCredentialAssetControls() {
  useEffect(() => {
    let credentials: AgileCertCredential[] = [];
    let scheduled = false;
    let disposed = false;

    const loadCredentials = async () => {
      if (localStorage.getItem('aura_logged_role') !== 'student') {
        credentials = [];
        return;
      }

      try {
        credentials = await getMyAgileCertCredentials();
        if (!disposed) enhanceCredentialCards(credentials);
      } catch (error) {
        console.error('Unable to prepare AgileCert credential download controls:', error);
      }
    };

    const scheduleApply = () => {
      if (scheduled || disposed) return;
      scheduled = true;
      window.requestAnimationFrame(() => {
        scheduled = false;
        enhanceCredentialCards(credentials);
      });
    };

    void loadCredentials();
    const observer = new MutationObserver(scheduleApply);
    observer.observe(document.body, { childList: true, subtree: true });

    const refresh = () => void loadCredentials();
    window.addEventListener('agilecert-credentials-refresh', refresh);

    return () => {
      disposed = true;
      observer.disconnect();
      window.removeEventListener('agilecert-credentials-refresh', refresh);
    };
  }, []);

  return null;
}
