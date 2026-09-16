import { msg, t } from '@lingui/core/macro';
import { useCallback } from 'react';
import { SidePanelPages } from 'twenty-shared/types';
import { IconPhone } from 'twenty-ui/icon';

import { useNavigateSidePanel } from '@/side-panel/hooks/useNavigateSidePanel';

type UseOpenAtlasCallPageInSidePanelProps = {
  contextStoreInstanceId: string;
};

export const useOpenAtlasCallPageInSidePanel = ({
  contextStoreInstanceId,
}: UseOpenAtlasCallPageInSidePanelProps) => {
  const { navigateSidePanel } = useNavigateSidePanel();

  const openAtlasCallPageInSidePanel = useCallback(() => {
    navigateSidePanel({
      page: SidePanelPages.AtlasCall,
      pageTitle: t(msg`Call with Atlas`),
      pageIcon: IconPhone,
      pageId: contextStoreInstanceId,
    });
  }, [navigateSidePanel, contextStoreInstanceId]);

  return {
    openAtlasCallPageInSidePanel,
  };
};
