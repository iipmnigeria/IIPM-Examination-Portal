import { useEffect } from 'react';

const normaliseButtonText = (button: HTMLButtonElement): string =>
  (button.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();

const isPayAndUnlockButton = (button: HTMLButtonElement): boolean => {
  const text = normaliseButtonText(button);
  return text.includes('pay and unlock') || text.includes('pay & unlock');
};

const isLaunchButton = (button: HTMLButtonElement): boolean =>
  normaliseButtonText(button).includes('launch secure session');

const hasIntentionallyHiddenAncestor = (
  element: HTMLElement,
  boundary: HTMLElement,
): boolean => {
  let current: HTMLElement | null = element;

  while (current && current !== boundary) {
    if (current.hidden || current.classList.contains('hidden')) return true;
    current = current.parentElement;
  }

  return false;
};

const restoreHiddenActionLayout = (mount: HTMLElement) => {
  const parent = mount.parentElement;
  if (!parent?.classList.contains('hidden')) return;

  parent.classList.remove(
    'flex',
    'min-w-[190px]',
    'flex-col',
    'items-stretch',
    'gap-2',
  );
};

const releaseLaunchGuard = (guard: HTMLElement) => {
  guard.hidden = false;
  guard.querySelectorAll<HTMLButtonElement>('button').forEach((button) => {
    button.style.removeProperty('display');
  });
};

const guardLockedLaunchButtons = (
  card: HTMLElement,
  examinationId: string,
  launchButtons: HTMLButtonElement[],
) => {
  launchButtons.forEach((launchButton) => {
    let guard = launchButton.closest<HTMLElement>(
      '[data-agilecert-cipmn-launch-guard="true"]',
    );

    if (!guard) {
      const parent = launchButton.parentElement;
      if (!parent) return;

      guard = document.createElement('div');
      guard.dataset.agilecertCipmnLaunchGuard = 'true';
      guard.dataset.agilecertCipmnCardCartMount = `launch-guard-${examinationId}`;

      if (launchButton.parentElement === parent) {
        parent.insertBefore(guard, launchButton);
        guard.appendChild(launchButton);
      }
    }

    guard.hidden = true;
    launchButton.style.display = 'none';
  });

  card
    .querySelectorAll<HTMLElement>('[data-agilecert-cipmn-launch-guard="true"]')
    .forEach((guard) => {
      guard.hidden = true;
      guard.querySelectorAll<HTMLButtonElement>('button').forEach((button) => {
        button.style.display = 'none';
      });
    });
};

const ensureVisibleCartMount = (
  card: HTMLElement,
  examinationId: string,
  payButton: HTMLButtonElement,
) => {
  const actionArea = payButton.parentElement;
  if (!actionArea || payButton.parentElement !== actionArea) return;

  const matchingMounts = Array.from(
    card.querySelectorAll<HTMLElement>('[data-agilecert-cipmn-card-cart-mount]'),
  ).filter(
    (element) => element.dataset.agilecertCipmnCardCartMount === examinationId,
  );

  let visibleMount = matchingMounts.find((mount) => mount.parentElement === actionArea);

  if (!visibleMount) {
    visibleMount = document.createElement('div');
    visibleMount.dataset.agilecertCipmnCardCartMount = examinationId;
    visibleMount.className = 'w-full';
    visibleMount.style.marginBottom = '0.5rem';

    if (payButton.parentElement === actionArea) {
      actionArea.insertBefore(visibleMount, payButton);
    }
  }

  actionArea.classList.add('flex', 'min-w-[190px]', 'flex-col', 'items-stretch', 'gap-2');
  visibleMount.classList.add('w-full');
  visibleMount.style.marginBottom = '0.5rem';

  matchingMounts.forEach((mount) => {
    if (mount === visibleMount) return;

    restoreHiddenActionLayout(mount);
    mount.dataset.agilecertCipmnCardCartMount = `stale-${examinationId}`;
    mount.style.display = 'none';
    mount.setAttribute('aria-hidden', 'true');
  });
};

const repairCard = (card: HTMLElement) => {
  const examinationId = card.id.replace(/^exam-card-/, '');
  if (!examinationId) return;

  const buttons = Array.from(card.querySelectorAll<HTMLButtonElement>('button'));
  const payButton = buttons.find(
    (button) => isPayAndUnlockButton(button) && !hasIntentionallyHiddenAncestor(button, card),
  );
  const launchButtons = buttons.filter(isLaunchButton);

  if (!payButton) {
    card
      .querySelectorAll<HTMLElement>('[data-agilecert-cipmn-launch-guard="true"]')
      .forEach(releaseLaunchGuard);
    launchButtons.forEach((button) => button.style.removeProperty('display'));
    return;
  }

  guardLockedLaunchButtons(card, examinationId, launchButtons);
  ensureVisibleCartMount(card, examinationId, payButton);
};

const repairCandidateCards = () => {
  document
    .querySelectorAll<HTMLElement>('[id^="exam-card-"]')
    .forEach((card) => {
      try {
        repairCard(card);
      } catch (error) {
        console.error('Unable to repair the CIPMN examination card actions.', error);
      }
    });
};

export default function CandidateCipmnCardMountRepair() {
  useEffect(() => {
    let scheduled = false;

    const scheduleRepair = () => {
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(() => {
        scheduled = false;
        repairCandidateCards();
      });
    };

    repairCandidateCards();

    const observer = new MutationObserver(scheduleRepair);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('iipm-commerce-refresh', scheduleRepair);
    window.addEventListener('agilecert-cipmn-cart-updated', scheduleRepair);

    return () => {
      observer.disconnect();
      window.removeEventListener('iipm-commerce-refresh', scheduleRepair);
      window.removeEventListener('agilecert-cipmn-cart-updated', scheduleRepair);
    };
  }, []);

  return null;
}
