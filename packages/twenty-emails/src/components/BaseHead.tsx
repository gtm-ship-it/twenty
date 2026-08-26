import { Font, Head } from 'react-email';

import { canvasTheme } from 'src/common-style';

export const BaseHead = () => {
  return (
    <Head>
      <title>PTS AI CRM</title>
      <Font
        fontFamily={canvasTheme.font.family}
        fallbackFontFamily="sans-serif"
        fontStyle="normal"
        fontWeight={canvasTheme.font.weight.regular}
      />
    </Head>
  );
};
