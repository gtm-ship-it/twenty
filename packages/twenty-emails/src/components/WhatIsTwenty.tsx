import { type I18n } from '@lingui/core';
import { MainText } from 'src/components/MainText';
import { SubTitle } from 'src/components/SubTitle';

type WhatIsTwentyProps = {
  i18n: I18n;
};

export const WhatIsTwenty = ({ i18n }: WhatIsTwentyProps) => {
  return (
    <>
      <SubTitle value={i18n._('What is PTS AI CRM?')} />
      <MainText>
        {i18n._(
          "It's the CRM where PTS AI and its clients track leads, deals and follow-ups. Your workspace is private to your team.",
        )}
      </MainText>
    </>
  );
};
