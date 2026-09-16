import { HeadlessEngineCommandWrapperEffect } from '@/command-menu-item/engine-command/components/HeadlessEngineCommandWrapperEffect';
import { useHeadlessCommandContextApi } from '@/command-menu-item/engine-command/hooks/useHeadlessCommandContextApi';
import { useOpenAtlasCallPageInSidePanel } from '@/side-panel/hooks/useOpenAtlasCallPageInSidePanel';

// PTS AI CRM: "Call with Atlas" sobre la selección actual (people, opportunities, companies).
export const CallWithAtlasCommand = () => {
  const { contextStoreInstanceId } = useHeadlessCommandContextApi();

  const { openAtlasCallPageInSidePanel } = useOpenAtlasCallPageInSidePanel({
    contextStoreInstanceId,
  });

  const handleExecute = () => {
    openAtlasCallPageInSidePanel();
  };

  return <HeadlessEngineCommandWrapperEffect execute={handleExecute} />;
};
