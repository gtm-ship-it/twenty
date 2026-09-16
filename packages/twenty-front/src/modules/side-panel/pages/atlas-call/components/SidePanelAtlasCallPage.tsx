import { styled } from '@linaria/react';

import { AtlasCallContainer } from '@/atlas-calls/components/AtlasCallContainer';
import { SidePanelPageComponentInstanceContext } from '@/side-panel/states/contexts/SidePanelPageComponentInstanceContext';
import { useComponentInstanceStateContext } from '@/ui/utilities/state/component-state/hooks/useComponentInstanceStateContext';

const StyledSidePanelAtlasCall = styled.div`
  height: 100%;
`;

// Página del panel lateral "Call with Atlas". El pageId es el instanceId del
// context store de la vista, así que la selección y los filtros llegan intactos.
export const SidePanelAtlasCallPage = () => {
  const sidePanelPageInstanceId = useComponentInstanceStateContext(
    SidePanelPageComponentInstanceContext,
  )?.instanceId;

  if (!sidePanelPageInstanceId) {
    throw new Error('Side panel page instance id is not defined');
  }

  return (
    <StyledSidePanelAtlasCall>
      <AtlasCallContainer contextStoreInstanceId={sidePanelPageInstanceId} />
    </StyledSidePanelAtlasCall>
  );
};
