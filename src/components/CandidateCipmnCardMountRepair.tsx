import { useEffect } from 'react';
import { getAvailableTests } from '../services/examService';
import type { Test } from '../types';

type CommerceTest = Test & {
  canLaunch?: boolean;
  accessStatus?: string;
  requiresPayment?: boolean;
};

const CARD_SELECTOR = '[id^="exam-card-"]';
const CART_MOUNT_ATTRIBUTE = 'data-agilecert-cipmn-card-cart-mount';
const PRIMARY_ACTION_ATTRIBUTE = 'data-agilecert-cipmn-primary-action';

const normaliseButtonText = (button: HTMLButtonElement): string =>
  (button.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();

const isPayAndUnlockButton = (button: HTMLButtonElement): boolean => {
  const text = normaliseButtonText(button);
  return (
    text.includes('pay and unlock')
    || text.includes('pay & unlock')
    || text.includes('pay for re-take')
  );
};

const isLaunchButton = (button: HTMLButtonElement): boolean => {
  const text = normaliseButtonText(button);
  return text.includes('launch secure session') || text.includes('launch secured session');
};

const isInsideCartMount = (button: HTMLButtonElement, examinationId: string): boolean =>
  Boolean(button.closest(`[${CART_MOUNT_ATTRIBUTE}="${examinationId}"]`));

const removeAccidentalActionLayout = (element: HTMLElement | null) => {
  if (!element) return;
  element.classList.remove(
    'flex',
    'min-w-[190px]',
    'flex-col',
    'items-stretch',
    'gap-2',
  );
};

const prepareLockedPrimaryAction = (
  button: HTMLButtonElement,
  card: HTMLElement,
  examinationId: string,
) => {
  if (!button.dataset.iipmOriginalLabel) {
    button.dataset.iipmOriginalLabel = button.textContent?.trim() || 'Launch Secured Session';
  }
  if (!button.dataset.iipmOriginalClass) {
    button.dataset.iipmOriginalClass = button.className;
  }

  button.dataset.agilecertCipmnPrimaryAction = examinationId;
  button.hidden = false;
  button.style.removeProperty('display');
  button.removeAttribute('aria-hidden');
  button.removeAttribute('tabindex');

  const completed = (card.textContent || '').includes('Exam Completed');
  const desiredText = completed ? 'Pay for Re-take' : 'Pay and Unlock';
  if (button.textContent?.trim() !== desiredText) {
    button.textContent = desiredText;
  }

  button.className =
    'px-4 py-2 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 whitespace-nowrap bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-sm hover:shadow';

  // Fail closed until CandidateCommerceOverlay attaches its capture handler.
  // This prevents the original React launch action from starting a locked exam.
  button.onclick = (event) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const container = button.parentElement;
  if (
    container?.dataset.agilecertCipmnCardCartMount
      === `launch-exclusion-${examinationId}`
  ) {
    delete container.dataset.agilecertCipmnCardCartMount;
  }
};

const prepareUnlockedPrimaryAction = (
  button: HTMLButtonElement,
  examinationId: string,
) => {
  button.dataset.agilecertCipmnPrimaryAction = examinationId;
  button.hidden = false;
  button.style.removeProperty('display');
  button.removeAttribute('aria-hidden');
  button.removeAttribute('tabindex');
  button.onclick = null;

  if (isPayAndUnlockButton(button)) {
    button.textContent = button.dataset.iipmOriginalLabel || 'Launch Secured Session';
  }
  if (button.dataset.iipmOriginalClass) {
    button.className = button.dataset.iipmOriginalClass;
  }
};

const ensureSafeCartMount = (
  card: HTMLElement,
  examinationId: string,
  primaryButton: HTMLButtonElement,
) => {
  const actionArea = primaryButton.parentElement;
  if (!actionArea || primaryButton.parentElement !== actionArea) return;

  const matchingMounts = Array.from(
    card.querySelectorAll<HTMLElement>(`[${CART_MOUNT_ATTRIBUTE}]`),
  ).filter(
    (element) => element.dataset.agilecertCipmnCardCartMount === examinationId,
  );

  let visibleMount = matchingMounts.find((mount) => mount.parentElement === actionArea);

  if (!visibleMount) {
    visibleMount = document.createElement('div');
    visibleMount.dataset.agilecertCipmnCardCartMount = examinationId;
    visibleMount.className = 'w-full';

    // Keep the primary payment/launch button first in DOM order so the legacy
    // commerce overlay always selects it, then place the cart control before it
    // visually with flex ordering. No live React portal host is moved.
    actionArea.insertBefore(visibleMount, primaryButton.nextSibling);
  }

  actionArea.classList.add(
    'flex',
    'min-w-[190px]',
    'flex-col',
    'items-stretch',
    'gap-2',
  );

  visibleMount.classList.add('w-full');
  visibleMount.style.order = '1';
  visibleMount.style.removeProperty('display');
  visibleMount.removeAttribute('aria-hidden');
  primaryButton.style.order = '2';

  matchingMounts.forEach((mount) => {
    if (mount === visibleMount) return;

    removeAccidentalActionLayout(mount.parentElement);
    mount.dataset.agilecertCipmnCardCartMount = `stale-${examinationId}`;
    mount.style.display = 'none';
    mount.setAttribute('aria-hidden', 'true');
  });
};

const cardLooksLikeCipmn = (card: HTMLElement): boolean =>
  (card.textContent || '').toUpperCase().includes('CIPMN-MOCK');

const findPrimaryAction = (
  card: HTMLElement,
  examinationId: string,
): HTMLButtonElement | null => {
  const buttons = Array.from(card.querySelectorAll<HTMLButtonElement>('button'));

  return (
    buttons.find(
      (button) => button.dataset.agilecertCipmnPrimaryAction === examinationId,
    )
    || buttons.find(
      (button) => isPayAndUnlockButton(button) && !isInsideCartMount(button, examinationId),
    )
    || buttons.find(
      (button) => isLaunchButton(button) && !isInsideCartMount(button, examinationId),
    )
    || null
  );
};

const repairCard = (
  card: HTMLElement,
  catalogueById: Map<string, CommerceTest>,
) => {
  const examinationId = card.id.replace(/^exam-card-/, '');
  if (!examinationId) return;

  const test = catalogueById.get(examinationId);
  const cipmnCard = test?.course === 'CIPMN-MOCK' || cardLooksLikeCipmn(card);
  if (!cipmnCard) return;

  const primaryButton = findPrimaryAction(card, examinationId);
  if (!primaryButton) return;

  const unlocked = Boolean(test?.canLaunch || test?.accessStatus === 'unlocked');
  const cardConfirmedLocked = (card.textContent || '')
    .toLowerCase()
    .includes('payment required');
  const locked = test
    ? test.course === 'CIPMN-MOCK' && !unlocked
    : cardConfirmedLocked;

  if (locked) {
    prepareLockedPrimaryAction(primaryButton, card, examinationId);
    ensureSafeCartMount(card, examinationId, primaryButton);
    return;
  }

  if (unlocked) {
    prepareUnlockedPrimaryAction(primaryButton, examinationId);
    ensureSafeCartMount(card, examinationId, primaryButton);
  }
};

const repairCandidateCards = (catalogueById: Map<string, CommerceTest>) => {
  document.querySelectorAll<HTMLElement>(CARD_SELECTOR).forEach((card) => {
    try {
      repairCard(card, catalogueById);
    } catch (error) {
      // One malformed or transitioning card must never terminate portal startup.
      console.error('Unable to reconcile the CIPMN examination card actions.', error);
    }
  });
};

export default function CandidateCipmnCardMountRepair() {
  useEffect(() => {
    let disposed = false;
    let scheduled = false;
    let catalogueById = new Map<string, CommerceTest>();

    const scheduleRepair = () => {
      if (scheduled || disposed) return;
      scheduled = true;
      window.requestAnimationFrame(() => {
        scheduled = false;
        if (!disposed) repairCandidateCards(catalogueById);
      });
    };

    const refreshCatalogue = async () => {
      try {
        const tests = await getAvailableTests() as CommerceTest[];
        if (disposed) return;
        catalogueById = new Map(tests.map((test) => [test.id, test]));
        scheduleRepair();
      } catch (error) {
        // The visible payment badge remains a safe fallback signal.
        console.error('Unable to refresh CIPMN card access state.', error);
        scheduleRepair();
      }
    };

    scheduleRepair();
    void refreshCatalogue();

    const observer = new MutationObserver(scheduleRepair);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'hidden'],
    });

    const refreshCommerce = () => {
      scheduleRepair();
      void refreshCatalogue();
    };

    window.addEventListener('iipm-commerce-refresh', refreshCommerce);
    window.addEventListener('agilecert-cipmn-cart-updated', scheduleRepair);

    return () => {
      disposed = true;
      observer.disconnect();
      window.removeEventListener('iipm-commerce-refresh', refreshCommerce);
      window.removeEventListener('agilecert-cipmn-cart-updated', scheduleRepair);
    };
  }, []);

  return null;
}
