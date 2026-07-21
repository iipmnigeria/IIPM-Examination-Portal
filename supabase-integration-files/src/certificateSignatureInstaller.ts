import { jsPDF } from 'jspdf';
import drAkorSignature from './assets/drAkorSignature';
import nwachukwuSignature from './assets/nwachukwuSignature';

type PatchedJsPdf = {
  __iipmSignatureLinesToSkip?: number;
  addImage: (...args: unknown[]) => unknown;
};

type JsPdfApi = Record<string, unknown> & {
  line?: (...args: unknown[]) => unknown;
  __iipmCertificateSignaturesInstalled?: boolean;
};

const nearlyEqual = (left: unknown, right: number): boolean =>
  typeof left === 'number' && Math.abs(left - right) < 0.01;

function installPdfSignatures(): void {
  const api = jsPDF.API as unknown as JsPdfApi;
  if (api.__iipmCertificateSignaturesInstalled || typeof api.line !== 'function') return;

  const originalLine = api.line;

  api.line = function patchedCertificateLine(this: PatchedJsPdf, ...args: unknown[]) {
    const remaining = this.__iipmSignatureLinesToSkip || 0;
    if (remaining > 0) {
      this.__iipmSignatureLinesToSkip = remaining - 1;
      return this;
    }

    const [x1, y1, x2, y2] = args;
    const isAkorVectorLine =
      nearlyEqual(x1, 38) &&
      nearlyEqual(y1, 166) &&
      nearlyEqual(x2, 42) &&
      nearlyEqual(y2, 154);

    const isNwachukwuVectorLine =
      nearlyEqual(x1, 210) &&
      nearlyEqual(y1, 160) &&
      nearlyEqual(x2, 220) &&
      nearlyEqual(y2, 153);

    if (isAkorVectorLine) {
      this.addImage(
        drAkorSignature,
        'PNG',
        35,
        145.5,
        45,
        25.6,
        'iipm-dr-akor-signature',
        'FAST',
      );
      this.__iipmSignatureLinesToSkip = 8;
      return this;
    }

    if (isNwachukwuVectorLine) {
      this.addImage(
        nwachukwuSignature,
        'PNG',
        204,
        146,
        44,
        24,
        'iipm-nwachukwu-signature',
        'FAST',
      );
      this.__iipmSignatureLinesToSkip = 8;
      return this;
    }

    return originalLine.apply(this, args);
  };

  api.__iipmCertificateSignaturesInstalled = true;
}

function replaceVisibleSignature(
  labelText: string,
  signatureDataUri: string,
  signatureKey: string,
  widthPx: number,
  heightPx: number,
): void {
  const nameLabels = Array.from(document.querySelectorAll('p')).filter(
    (element) => element.textContent?.trim() === labelText,
  );

  nameLabels.forEach((nameLabel) => {
    const signatureBlock = nameLabel.parentElement;
    if (!signatureBlock) return;

    const existingSignature = signatureBlock.querySelector(`[data-signature-key="${signatureKey}"]`);
    if (existingSignature) return;

    const currentVisual = signatureBlock.firstElementChild;
    if (!currentVisual) return;

    const signatureImage = document.createElement('img');
    signatureImage.src = signatureDataUri;
    signatureImage.alt = `${labelText} signature`;
    signatureImage.draggable = false;
    signatureImage.dataset.signatureKey = signatureKey;
    signatureImage.style.display = 'block';
    signatureImage.style.width = `${widthPx}px`;
    signatureImage.style.height = `${heightPx}px`;
    signatureImage.style.objectFit = 'contain';
    signatureImage.style.margin = '0 auto';
    signatureImage.style.opacity = '0.98';
    signatureImage.style.userSelect = 'none';
    signatureImage.style.pointerEvents = 'none';

    currentVisual.replaceWith(signatureImage);
  });
}

function installVisibleSignatures(): void {
  if (typeof document === 'undefined') return;

  const applyVisibleSignatures = () => {
    replaceVisibleSignature('Dr. Kashim Akor', drAkorSignature, 'dr-akor', 138, 62);
    replaceVisibleSignature(
      'Barr. Peter N. Nwachukwu',
      nwachukwuSignature,
      'peter-nwachukwu',
      144,
      58,
    );
  };

  const initialise = () => {
    applyVisibleSignatures();
    const observer = new MutationObserver(() => applyVisibleSignatures());
    observer.observe(document.documentElement, { childList: true, subtree: true });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialise, { once: true });
  } else {
    initialise();
  }
}

installPdfSignatures();
installVisibleSignatures();
