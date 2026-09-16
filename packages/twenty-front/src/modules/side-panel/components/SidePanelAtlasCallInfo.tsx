import { t } from '@lingui/core/macro';
import { useContext } from 'react';
import { IconPhone } from 'twenty-ui/icon';
import { ThemeContext } from 'twenty-ui/theme-constants';

import { useFindManyRecordsSelectedInContextStore } from '@/context-store/hooks/useFindManyRecordsSelectedInContextStore';
import { useNumberFormat } from '@/localization/hooks/useNumberFormat';
import { SidePanelPageInfoLayout } from '@/side-panel/components/SidePanelPageInfoLayout';

type SidePanelAtlasCallInfoProps = {
  sidePanelPageInstanceId: string;
};

export const SidePanelAtlasCallInfo = ({
  sidePanelPageInstanceId,
}: SidePanelAtlasCallInfoProps) => {
  const { theme } = useContext(ThemeContext);
  const { formatNumber } = useNumberFormat();
  const { totalCount } = useFindManyRecordsSelectedInContextStore({
    instanceId: sidePanelPageInstanceId,
    limit: 1,
  });

  return (
    <SidePanelPageInfoLayout
      icon={
        <IconPhone size={theme.icon.size.md} stroke={theme.icon.stroke.sm} />
      }
      iconColor={theme.font.color.tertiary}
      title={t`Call with Atlas`}
      label={t`${formatNumber(totalCount ?? 0)} selected`}
    />
  );
};
