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

const normaliseButtonText = (button: HTMLButtonElement): string =>
  (button.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();

const isPayAndUnlockButton = (button: HTMLButtonElement): boolean => {
  const text = normaliseButtonText(button);
  return text.includes('pay and unlock') || text.includes('pay & unlock');
};

const isLaunchButton = (button: HTMLButtonElement): boolean => {
  const text = normaliseButtonText(button);
  return text.includes('launch secure session') || text.includes('launch secured session');
};

const hasHiddenAncestor = (element: HTMLElement, boundary: HTMLElement): boolean => {
  let current: HTMLElement | null = element;

  while (current && current !== boundary) {
    if (current.hidden || current.classList.contains('hidden')) return true;
    current = current.parentElement;
  }

  return false;
};

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

const excludeLockedLaunchButton = (
  button: HTMLButtonElement,
  examinationId: string,
) => {
  button.hidden = true;
  button.style.display = 'none';
  button.setAttribute('aria-hidden', 'true');
  button.setAttribute('tabindex', '-1');

  const container = button.parentElement;
  if (!container) return;

  removeAccidentalActionLayout(container);
  container.dataset.agilecertCipmnCardCartMount = `launch-exclusion-${examinationId}`;
};

const releaseUnlockedLaunchButton = (
  button: HTMLButtonElement,
  examinationId: string,
) => {
  button.hidden = false;
  button.style.removeProperty('display');
  button.removeAttribute('aria-hidden');
  button.removeAttribute('tabindex');

  const container = button.parentElement;
  if (
    container?.dataset.agilecertCipmnCardCartMount
      === `launch-exclusion-${examinationId}`
  ) {
    delete container.dataset.agilecertCipmnCardCartMount;
  }
};

const ensureSafeCartMount = (
  card: HTMLElement,
  examinationId: string,
  payButton: HTMLButtonElement,
) => {
  const actionArea = payButton.parentElement;
  if (!actionArea || payButton.parentElement !== actionArea) return;

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
    visibleMount.style.marginBottom = '0.5rem';

    // The mount is always a newly created empty element. We never move an
    // existing React portal host or any examination action container.
    if (payButton.parentElement === actionArea) {
      actionArea.insertBefore(visibleMount, payButton);
    }
  }

  actionArea.classList.add(
    'flex',
    'min-w-[190px]',
    'flex-col',
    'items-stretch',
    'gap-2',
  );
  visibleMount.classList.add('w-full');
  visibleMount.style.marginBottom = '0.5rem';
  visibleMount.style.removeProperty('display');
  visibleMount.removeAttribute('aria-hidden');

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

const repairCard = (
  card: HTMLElement,
  catalogueById: Map<string, CommerceTest>,
) => {
  const examinationId = card.id.replace(/^exam-card-/, '');
  if (!examinationId) return;

  const test = catalogueById.get(examinationId);
  const cipmnCard = test?.course === 'CIPMN-MOCK' || cardLooksLikeCipmn(card);
  if (!cipmnCard) return;

  const buttons = Array.from(card.querySelectorAll<HTMLButtonElement>('button'));
  const launchButtons = buttons.filter(isLaunchButton);
  const payButton = buttons.find(
    (button) => isPayAndUnlockButton(button) && !hasHiddenAncestor(button, card),
  );

  const unlocked = Boolean(test?.canLaunch || test?.accessStatus === 'unlocked');
  const serverConfirmedLocked = Boolean(test && test.course === 'CIPMN-MOCK' && !unlocked);
  const cardConfirmedLocked = Boolean(
    payButton
      || (card.textContent || '').toLowerCase().includes('payment required'),
  );
  const locked = serverConfirmedLocked || cardConfirmedLocked;

  if (locked) {
    launchButtons.forEach((button) => excludeLockedLaunchButton(button, examinationId));
    if (payButton) ensureSafeCartMount(card, examinationId, payButton);
    return;
  }

  if (unlocked) {
    launchButtons.forEach((button) => releaseUnlockedLaunchButton(button, examinationId));
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
        // Payment controls rendered on the card remain a safe fallback signal.
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
