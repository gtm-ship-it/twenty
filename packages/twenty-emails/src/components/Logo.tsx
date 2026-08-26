import { Img } from 'react-email';

const logoStyle = {
  marginBottom: '40px',
};

export const Logo = () => {
  return (
    <Img
      src="https://app.crm.pts-automation.cloud/images/ptsai-logo.png"
      alt="PTS AI"
      width="120"
      height="60"
      style={logoStyle}
    />
  );
};
