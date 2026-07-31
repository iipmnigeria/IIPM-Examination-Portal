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

const removeIncorrectDisplayOverride = (mount: HTMLElement) => {
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

const unwrapLaunchGuard = (guard: HTMLElement) => {
  const launchButton = guard.querySelector<HTMLButtonElement>('button');
  if (launchButton && guard.parentNode) {
    launchButton.style.removeProperty('display');
    guard.parentNode.insertBefore(launchButton, guard);
  }
  guard.remove();
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
      .forEach(unwrapLaunchGuard);
    launchButtons.forEach((button) => button.style.removeProperty('display'));
    return;
  }

  launchButtons.forEach((launchButton) => {
    let guard = launchButton.closest<HTMLElement>(
      '[data-agilecert-cipmn-launch-guard="true"]',
    );

    if (!guard) {
      guard = document.createElement('div');
      guard.dataset.agilecertCipmnLaunchGuard = 'true';
      guard.dataset.agilecertCipmnCardCartMount = `launch-guard-${examinationId}`;
      launchButton.parentNode?.insertBefore(guard, launchButton);
      guard.appendChild(launchButton);
    }

    guard.hidden = true;
    launchButton.style.display = 'none';
  });

  const actionArea = payButton.parentElement;
  if (!actionArea) return;

  const matchingMounts = Array.from(
    card.querySelectorAll<HTMLElement>('[data-agilecert-cipmn-card-cart-mount]'),
  ).filter(
    (element) => element.dataset.agilecertCipmnCardCartMount === examinationId,
  );

  let canonicalMount = matchingMounts.find((element) => element.parentElement === actionArea)
    || matchingMounts[0];

  if (!canonicalMount) {
    canonicalMount = document.createElement('div');
    canonicalMount.dataset.agilecertCipmnCardCartMount = examinationId;
  }

  matchingMounts.forEach((mount) => {
    if (mount !== canonicalMount) mount.remove();
  });

  removeIncorrectDisplayOverride(canonicalMount);

  if (canonicalMount.parentElement !== actionArea || canonicalMount.nextSibling !== payButton) {
    actionArea.insertBefore(canonicalMount, payButton);
  }

  canonicalMount.classList.add('w-full');
  canonicalMount.style.marginBottom = '0.5rem';
};

const repairCandidateCards = () => {
  document
    .querySelectorAll<HTMLElement>('[id^="exam-card-"]')
    .forEach(repairCard);
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
