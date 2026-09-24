import { useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import CipmnOpenMaterialsAction from './CipmnOpenMaterialsAction';

const ROOT_KEY = '__agilecertCipmnMaterialsRoot';

type MountElement = HTMLDivElement & {
  [ROOT_KEY]?: Root;
};

function attachOpenMaterialsActions() {
  document.querySelectorAll<HTMLElement>('[id^="exam-card-"]').forEach((card) => {
    const examinationId = card.id.replace(/^exam-card-/, '').trim();
    if (!examinationId || card.querySelector('[data-agilecert-cipmn-open-materials="true"]')) return;

    const examAction = card.querySelector<HTMLButtonElement>('button[data-agilecert-access-status]');
    const actionContainer = examAction?.parentElement;
    if (!examAction || !actionContainer) return;

    const accessStatus = examAction.dataset.agilecertAccessStatus?.trim().toLowerCase();
    const locked = accessStatus !== 'unlocked';

    const mount = document.createElement('div') as MountElement;
    mount.dataset.agilecertCipmnOpenMaterials = 'true';
    mount.className = 'mt-2 flex justify-end';
    actionContainer.appendChild(mount);

    const root = createRoot(mount);
    mount[ROOT_KEY] = root;
    root.render(<CipmnOpenMaterialsAction examinationId={examinationId} locked={locked} />);
  });
}

export default function CipmnModuleMaterialsMount() {
  useEffect(() => {
    attachOpenMaterialsActions();

    const observer = new MutationObserver(() => attachOpenMaterialsActions());
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      document.querySelectorAll<MountElement>('[data-agilecert-cipmn-open-materials="true"]').forEach((mount) => {
        mount[ROOT_KEY]?.unmount();
        mount.remove();
      });
    };
  }, []);

  return null;
}
