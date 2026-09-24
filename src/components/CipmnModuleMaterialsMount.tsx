import { useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import CipmnOpenMaterialsAction from './CipmnOpenMaterialsAction';
import CipmnModuleHubContext from './CipmnModuleHubContext';

const MATERIALS_ROOT_KEY = '__agilecertCipmnMaterialsRoot';
const HUB_ROOT_KEY = '__agilecertCipmnHubRoot';

type MountElement = HTMLDivElement & {
  [MATERIALS_ROOT_KEY]?: Root;
  [HUB_ROOT_KEY]?: Root;
};

function attachCipmnModuleEnhancements() {
  document.querySelectorAll<HTMLElement>('[id^="exam-card-"]').forEach((card) => {
    const examinationId = card.id.replace(/^exam-card-/, '').trim();
    if (!examinationId) return;

    const examAction = card.querySelector<HTMLButtonElement>('button[data-agilecert-access-status]');
    const actionContainer = examAction?.parentElement;
    if (!examAction || !actionContainer) return;

    const accessStatus = examAction.dataset.agilecertAccessStatus?.trim().toLowerCase();
    const locked = accessStatus !== 'unlocked';
    const examUnlocked = !locked && !examAction.disabled;

    if (!card.querySelector('[data-agilecert-cipmn-open-materials="true"]')) {
      const materialsMount = document.createElement('div') as MountElement;
      materialsMount.dataset.agilecertCipmnOpenMaterials = 'true';
      materialsMount.className = 'mt-2 flex justify-end';
      actionContainer.appendChild(materialsMount);

      const materialsRoot = createRoot(materialsMount);
      materialsMount[MATERIALS_ROOT_KEY] = materialsRoot;
      materialsRoot.render(<CipmnOpenMaterialsAction examinationId={examinationId} locked={locked} />);
    }

    if (!card.querySelector('[data-agilecert-cipmn-module-hub-mount="true"]')) {
      const moduleTitle = card.querySelector('h3')?.textContent?.trim() || 'CIPMN Module';
      const hubMount = document.createElement('div') as MountElement;
      hubMount.dataset.agilecertCipmnModuleHubMount = 'true';
      card.appendChild(hubMount);

      const hubRoot = createRoot(hubMount);
      hubMount[HUB_ROOT_KEY] = hubRoot;
      hubRoot.render(
        <CipmnModuleHubContext
          moduleTitle={moduleTitle}
          materialsUnlocked={!locked}
          examUnlocked={examUnlocked}
          onAttemptMcq={examUnlocked ? () => examAction.click() : undefined}
        />,
      );
    }
  });
}

export default function CipmnModuleMaterialsMount() {
  useEffect(() => {
    attachCipmnModuleEnhancements();

    const observer = new MutationObserver(() => attachCipmnModuleEnhancements());
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      document.querySelectorAll<MountElement>('[data-agilecert-cipmn-open-materials="true"]').forEach((mount) => {
        mount[MATERIALS_ROOT_KEY]?.unmount();
        mount.remove();
      });
      document.querySelectorAll<MountElement>('[data-agilecert-cipmn-module-hub-mount="true"]').forEach((mount) => {
        mount[HUB_ROOT_KEY]?.unmount();
        mount.remove();
      });
    };
  }, []);

  return null;
}
