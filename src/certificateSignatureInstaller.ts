import { jsPDF } from 'jspdf';
import drAkorSignature from './assets/drAkorSignature';

type PatchedJsPdf = {
  __iipmDrAkorLinesToSkip?: number;
  addImage: (...args: unknown[]) => unknown;
};

type JsPdfApi = Record<string, unknown> & {
  line?: (...args: unknown[]) => unknown;
  __iipmDrAkorSignatureInstalled?: boolean;
};

const nearlyEqual = (left: unknown, right: number): boolean =>
  typeof left === 'number' && Math.abs(left - right) < 0.01;

function installPdfSignature(): void {
  const api = jsPDF.API as unknown as JsPdfApi;
  if (api.__iipmDrAkorSignatureInstalled || typeof api.line !== 'function') return;

  const originalLine = api.line;

  api.line = function patchedCertificateLine(this: PatchedJsPdf, ...args: unknown[]) {
    const remaining = this.__iipmDrAkorLinesToSkip || 0;
    if (remaining > 0) {
      this.__iipmDrAkorLinesToSkip = remaining - 1;
      return this;
    }

    const [x1, y1, x2, y2] = args;
    const isFirstAkorVectorLine =
      nearlyEqual(x1, 38) &&
      nearlyEqual(y1, 166) &&
      nearlyEqual(x2, 42) &&
      nearlyEqual(y2, 154);

    if (isFirstAkorVectorLine) {
      this.addImage(
        drAkorSignature,
        'PNG',
        38,
        145.5,
        44,
        24.8,
        'iipm-dr-akor-signature',
        'FAST',
      );
      // The original certificate draws eight additional vector lines after this one.
      this.__iipmDrAkorLinesToSkip = 8;
      return this;
    }

    return originalLine.apply(this, args);
  };

  api.__iipmDrAkorSignatureInstalled = true;
}

function replaceVisibleSignature(): void {
  const nameLabels = Array.from(document.querySelectorAll('p')).filter(
    (element) => element.textContent?.trim() === 'Dr. Kashim Akor',
  );

  nameLabels.forEach((nameLabel) => {
    const signatureBlock = nameLabel.parentElement;
    if (!signatureBlock || signatureBlock.querySelector('[data-dr-akor-signature]')) return;

    const existingVector = signatureBlock.querySelector('svg');
    if (!existingVector) return;

    const signatureImage = document.createElement('img');
    signatureImage.src = drAkorSignature;
    signatureImage.alt = 'Dr. Kashim Akor signature';
    signatureImage.draggable = false;
    signatureImage.dataset.drAkorSignature = 'true';
    signatureImage.style.display = 'block';
    signatureImage.style.width = '132px';
    signatureImage.style.height = '58px';
    signatureImage.style.objectFit = 'contain';
    signatureImage.style.margin = '0 auto';
    signatureImage.style.opacity = '0.96';
    signatureImage.style.userSelect = 'none';

    existingVector.replaceWith(signatureImage);
  });
}

function installVisibleSignature(): void {
  if (typeof document === 'undefined') return;

  const initialise = () => {
    replaceVisibleSignature();
    const observer = new MutationObserver(() => replaceVisibleSignature());
    observer.observe(document.documentElement, { childList: true, subtree: true });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialise, { once: true });
  } else {
    initialise();
  }
}

installPdfSignature();
installVisibleSignature();
