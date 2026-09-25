import { useEffect, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import CipmnOpenMaterialsAction from './CipmnOpenMaterialsAction';
import CipmnModuleHubContext from './CipmnModuleHubContext';

const MATERIALS_ROOT_KEY = '__agilecertCipmnMaterialsRoot';
const HUB_ROOT_KEY = '__agilecertCipmnHubRoot';

type MountElement = HTMLDivElement & {
  [MATERIALS_ROOT_KEY]?: Root;
  [HUB_ROOT_KEY]?: Root;
};

function disposeMount(mount: MountElement) {
  // The dashboard may be unmounting inside a React commit. Dispose the nested
  // root afterwards, including hosts already detached with their exam card.
  queueMicrotask(() => {
    mount[MATERIALS_ROOT_KEY]?.unmount();
    mount[HUB_ROOT_KEY]?.unmount();
    mount.remove();
  });
}

function attachCipmnModuleEnhancements(onAttemptMcq: (examinationId: string) => void, mounts: Set<MountElement>) {
  mounts.forEach((mount) => {
    if (!mount.isConnected) {
      mounts.delete(mount);
      disposeMount(mount);
    }
  });
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
      mounts.add(materialsMount);

      const materialsRoot = createRoot(materialsMount);
      materialsMount[MATERIALS_ROOT_KEY] = materialsRoot;
      materialsRoot.render(<CipmnOpenMaterialsAction examinationId={examinationId} locked={locked} />);
    }

    if (!card.querySelector('[data-agilecert-cipmn-module-hub-mount="true"]')) {
      const moduleTitle = card.querySelector('h3')?.textContent?.trim() || 'CIPMN Module';
      const hubMount = document.createElement('div') as MountElement;
      hubMount.dataset.agilecertCipmnModuleHubMount = 'true';
      card.appendChild(hubMount);
      mounts.add(hubMount);

      const hubRoot = createRoot(hubMount);
      hubMount[HUB_ROOT_KEY] = hubRoot;
      hubRoot.render(
        <CipmnModuleHubContext
          examinationId={examinationId}
          moduleTitle={moduleTitle}
          materialsUnlocked={!locked}
          examUnlocked={examUnlocked}
          onAttemptMcq={examUnlocked ? () => {
            const currentAction = card.querySelector<HTMLButtonElement>('button[data-agilecert-access-status]');
            if (currentAction?.dataset.agilecertAccessStatus === 'unlocked' && !currentAction.disabled) {
              onAttemptMcq(examinationId);
            }
          } : undefined}
          onStartTheory={examUnlocked ? () => {
            const currentAction = card.querySelector<HTMLButtonElement>('button[data-agilecert-access-status]');
            if (currentAction?.dataset.agilecertAccessStatus === 'unlocked' && !currentAction.disabled) {
              currentAction.click();
            }
          } : undefined}
        />,
      );
    }
  });
}

export default function CipmnModuleMaterialsMount({ onAttemptMcq }: { onAttemptMcq: (examinationId: string) => void }) {
  const onAttemptMcqRef = useRef(onAttemptMcq);
  onAttemptMcqRef.current = onAttemptMcq;
  useEffect(() => {
    const mounts = new Set<MountElement>();
    const attach = () => attachCipmnModuleEnhancements((examinationId) => onAttemptMcqRef.current(examinationId), mounts);
    attach();

    const observer = new MutationObserver(attach);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      mounts.forEach((mount) => {
        mount.remove();
        disposeMount(mount);
      });
      mounts.clear();
    };
  }, []);

  return null;
}
