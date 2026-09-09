import { styled } from '@linaria/react';
import { useLingui } from '@lingui/react/macro';
import { useState } from 'react';
import { type Control, Controller, useFormContext } from 'react-hook-form';

import { Select } from '@/ui/input/components/Select';
import { SettingsTextInput } from '@/ui/input/components/SettingsTextInput';

import { SettingsAccountsPasswordController } from '@/settings/accounts/components/SettingsAccountsPasswordController';
import { type ConnectionFormData } from '@/settings/accounts/hooks/useImapSmtpCaldavConnectionForm';
import { EmailConnectionSecurity } from '~/generated-metadata/graphql';
import { type AccountType } from 'twenty-shared/constants';
import { Toggle } from 'twenty-ui/input';
import { H2Title } from 'twenty-ui/typography';
import { Section } from 'twenty-ui/layout';
import { MOBILE_VIEWPORT, themeCssVariables } from 'twenty-ui/theme-constants';

const StyledFormContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[6]};
`;

const StyledConnectionSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledSectionHeader = styled.div`
  margin-bottom: ${themeCssVariables.spacing[2]};
`;

const StyledSectionTitle = styled.h3`
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.md};
  font-weight: ${themeCssVariables.font.weight.medium};
  margin: 0;
  margin-bottom: ${themeCssVariables.spacing[1]};
`;

const StyledSectionDescription = styled.p`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
  margin: 0;
`;

const StyledHelpLink = styled.a`
  color: ${themeCssVariables.font.color.primary};
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
`;

const StyledStepsCard = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[4]};
`;

const StyledStep = styled.div`
  display: flex;
  gap: ${themeCssVariables.spacing[3]};
`;

const StyledStepNumber = styled.div`
  align-items: center;
  background: ${themeCssVariables.color.blue};
  border-radius: 50%;
  color: #fff;
  display: flex;
  flex-shrink: 0;
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  height: 22px;
  justify-content: center;
  width: 22px;
`;

const StyledStepBody = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
  min-width: 0;
`;

const StyledStepTitle = styled.span`
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.md};
  font-weight: ${themeCssVariables.font.weight.semiBold};
`;

const StyledStepText = styled.span`
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.sm};
  line-height: 1.5;
`;

const StyledToggleRow = styled.div`
  align-items: center;
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledAdvancedLink = styled.button`
  align-self: flex-start;
  background: transparent;
  border: none;
  color: ${themeCssVariables.font.color.tertiary};
  cursor: pointer;
  font-family: inherit;
  font-size: ${themeCssVariables.font.size.sm};
  padding: 0;
  text-decoration: underline;

  &:hover {
    color: ${themeCssVariables.font.color.primary};
  }
`;

const StyledFieldRow = styled.div`
  display: flex;
  gap: ${themeCssVariables.spacing[3]};

  @media (max-width: ${MOBILE_VIEWPORT}px) {
    flex-direction: column;
  }
`;

const StyledFieldGroup = styled.div`
  flex: 1;

  & > * {
    width: 100%;
  }
`;

type SettingsAccountsConnectionFormProps = {
  control: Control<ConnectionFormData>;
  isEditing: boolean;
  existingProtocols?: AccountType[];
};

export const SettingsAccountsConnectionForm = ({
  control,
  isEditing,
  existingProtocols = [],
}: SettingsAccountsConnectionFormProps) => {
  const { t } = useLingui();

  const [isProtocolPasswordBeingEdited, setIsProtocolPasswordBeingEdited] =
    useState<Record<AccountType, boolean>>({
      IMAP: false,
      SMTP: false,
      CALDAV: false,
    });

  const isPasswordInputDisabled = (protocol: AccountType) =>
    existingProtocols.includes(protocol) &&
    !isProtocolPasswordBeingEdited[protocol];

  const getDescription = () => {
    if (isEditing) {
      return t`Update your account's configuration. Configure any combination of IMAP, SMTP, and CalDAV as needed.`;
    }
    return t`You can set up any combination of IMAP (receiving emails), SMTP (sending emails), and CalDAV (calendar sync).`;
  };

  const handlePortChange = (value: string) => Number(value);

  // Modo simple (por defecto al conectar una cuenta nueva de Google):
  // el usuario solo escribe correo + App Password; el resto se rellena solo.
  const { setValue, watch } = useFormContext<ConnectionFormData>();
  const emailAddress = watch('handle');
  const [isAdvancedMode, setIsAdvancedMode] = useState(isEditing);
  const [shouldSyncCalendar, setShouldSyncCalendar] = useState(true);

  const applyGoogleSettings = ({
    address,
    password,
    withCalendar,
  }: {
    address: string;
    password: string;
    withCalendar: boolean;
  }) => {
    const cleanAddress = address.trim();
    // Google muestra el App Password en grupos de 4; pegarlo con espacios es
    // el error mas comun, asi que los quitamos por el usuario.
    const cleanPassword = password.replace(/\s/g, '');

    setValue('IMAP.host', 'imap.gmail.com', { shouldDirty: true });
    setValue('IMAP.port', 993, { shouldDirty: true });
    setValue('IMAP.connectionSecurity', EmailConnectionSecurity.SSL_TLS, {
      shouldDirty: true,
    });
    setValue('IMAP.username', cleanAddress, { shouldDirty: true });
    setValue('IMAP.password', cleanPassword, { shouldDirty: true });

    setValue('SMTP.host', 'smtp.gmail.com', { shouldDirty: true });
    setValue('SMTP.port', 465, { shouldDirty: true });
    setValue('SMTP.connectionSecurity', EmailConnectionSecurity.SSL_TLS, {
      shouldDirty: true,
    });
    setValue('SMTP.username', cleanAddress, { shouldDirty: true });
    setValue('SMTP.password', cleanPassword, { shouldDirty: true });

    if (withCalendar && cleanAddress.length > 0) {
      setValue(
        'CALDAV.host',
        `https://apidata.googleusercontent.com/caldav/v2/${cleanAddress}/events`,
        { shouldDirty: true },
      );
      setValue('CALDAV.port', 443, { shouldDirty: true });
      setValue('CALDAV.connectionSecurity', EmailConnectionSecurity.SSL_TLS, {
        shouldDirty: true,
      });
      setValue('CALDAV.username', cleanAddress, { shouldDirty: true });
      setValue('CALDAV.password', cleanPassword, { shouldDirty: true });
    } else {
      setValue('CALDAV.host', '', { shouldDirty: true });
      setValue('CALDAV.username', '', { shouldDirty: true });
      setValue('CALDAV.password', '', { shouldDirty: true });
    }
  };

  const [simplePassword, setSimplePassword] = useState('');

  const handleSimpleEmailChange = (value: string) => {
    setValue('handle', value, { shouldDirty: true });
    applyGoogleSettings({
      address: value,
      password: simplePassword,
      withCalendar: shouldSyncCalendar,
    });
  };

  const handleSimplePasswordChange = (value: string) => {
    setSimplePassword(value);
    applyGoogleSettings({
      address: emailAddress ?? '',
      password: value,
      withCalendar: shouldSyncCalendar,
    });
  };

  const handleToggleCalendar = (value: boolean) => {
    setShouldSyncCalendar(value);
    applyGoogleSettings({
      address: emailAddress ?? '',
      password: simplePassword,
      withCalendar: value,
    });
  };

  return (
    <Section>
      <H2Title title={t`Mail Account`} description={getDescription()} />
      {!isAdvancedMode && (
        <StyledStepsCard>
          <StyledStep>
            <StyledStepNumber>1</StyledStepNumber>
            <StyledStepBody>
              <StyledStepTitle>{t`Create an App Password in Google`}</StyledStepTitle>
              <StyledStepText>
                {t`Google does not accept your normal password here. Open`}{' '}
                <StyledHelpLink
                  href="https://myaccount.google.com/apppasswords"
                  target="_blank"
                  rel="noreferrer"
                >
                  myaccount.google.com/apppasswords
                </StyledHelpLink>
                {t`, type a name (for example "CRM") and click Create. Google shows you a 16-character password — copy it.`}
              </StyledStepText>
              <StyledStepText>
                {t`If that page does not open, turn on 2-Step Verification in your Google account first, then come back.`}
              </StyledStepText>
            </StyledStepBody>
          </StyledStep>

          <StyledStep>
            <StyledStepNumber>2</StyledStepNumber>
            <StyledStepBody>
              <StyledStepTitle>{t`Type your email address`}</StyledStepTitle>
              <SettingsTextInput
                instanceId="simple-email-connection-form"
                label={t`Email address`}
                placeholder={t`you@company.com`}
                value={emailAddress ?? ''}
                onChange={handleSimpleEmailChange}
                fullWidth
              />
            </StyledStepBody>
          </StyledStep>

          <StyledStep>
            <StyledStepNumber>3</StyledStepNumber>
            <StyledStepBody>
              <StyledStepTitle>{t`Paste the App Password`}</StyledStepTitle>
              <SettingsTextInput
                instanceId="simple-password-connection-form"
                label={t`App Password`}
                type="password"
                placeholder={t`16 characters from Google`}
                value={simplePassword}
                onChange={handleSimplePasswordChange}
                fullWidth
              />
              <StyledStepText>
                {t`Spaces are removed automatically — you can paste it exactly as Google shows it.`}
              </StyledStepText>
            </StyledStepBody>
          </StyledStep>

          <StyledStep>
            <StyledStepNumber>4</StyledStepNumber>
            <StyledStepBody>
              <StyledStepTitle>{t`Calendar`}</StyledStepTitle>
              <StyledToggleRow>
                <Toggle
                  value={shouldSyncCalendar}
                  onChange={handleToggleCalendar}
                />
                <StyledStepText>
                  {t`Also sync my calendar events (recommended).`}
                </StyledStepText>
              </StyledToggleRow>
              <StyledStepText>
                {t`That is all — servers, ports and security are set for you. Click Save.`}
              </StyledStepText>
            </StyledStepBody>
          </StyledStep>

          <StyledAdvancedLink
            type="button"
            onClick={() => setIsAdvancedMode(true)}
          >
            {t`Not a Google account? Enter the server settings manually`}
          </StyledAdvancedLink>
        </StyledStepsCard>
      )}

      {isAdvancedMode && !isEditing && (
        <StyledAdvancedLink type="button" onClick={() => setIsAdvancedMode(false)}>
          {t`Back to the guided Google setup`}
        </StyledAdvancedLink>
      )}
      {isAdvancedMode && (
      <StyledFormContainer>
        <Controller
          name="name"
          control={control}
          render={({ field, fieldState }) => (
            <SettingsTextInput
              instanceId="name-connection-form"
              label={t`Name`}
              placeholder={t`John Doe`}
              value={field.value}
              onChange={field.onChange}
              error={fieldState.error?.message}
              required={false}
            />
          )}
        />

        <Controller
          name="handle"
          control={control}
          render={({ field, fieldState }) => (
            <SettingsTextInput
              instanceId="email-address-connection-form"
              label={t`Email Address`}
              placeholder={t`john.doe@example.com`}
              value={field.value}
              onChange={field.onChange}
              error={fieldState.error?.message}
            />
          )}
        />

        <StyledConnectionSection>
          <StyledSectionHeader>
            <StyledSectionTitle>{t`IMAP Configuration`}</StyledSectionTitle>
            <StyledSectionDescription>
              {t`Configure IMAP settings to receive and sync your emails.`}{' '}
              {t`Leave blank if you don't need to import emails.`}{' '}
              {t`Gmail: imap.gmail.com, port 993, SSL/TLS.`}
            </StyledSectionDescription>
          </StyledSectionHeader>

          <Controller
            name="IMAP.host"
            control={control}
            render={({ field, fieldState }) => (
              <SettingsTextInput
                instanceId="imap-host-connection-form"
                label={t`IMAP Server`}
                placeholder={t`imap.gmail.com`}
                value={field.value || ''}
                onChange={field.onChange}
                error={fieldState.error?.message}
              />
            )}
          />

          <Controller
            name="IMAP.username"
            control={control}
            render={({ field, fieldState }) => (
              <SettingsTextInput
                instanceId="imap-username-connection-form"
                label={t`IMAP Username (Optional)`}
                placeholder={t`john.doe`}
                type="text"
                value={field.value || ''}
                required={false}
                onChange={field.onChange}
                error={fieldState.error?.message}
              />
            )}
          />

          <SettingsAccountsPasswordController
            protocol="IMAP"
            label={t`IMAP Password (App Password)`}
            control={control}
            disabled={isPasswordInputDisabled('IMAP')}
            onUnlock={() =>
              setIsProtocolPasswordBeingEdited((prev) => ({
                ...prev,
                IMAP: true,
              }))
            }
          />

          <StyledFieldRow>
            <StyledFieldGroup>
              <Controller
                name="IMAP.port"
                control={control}
                render={({ field, fieldState }) => (
                  <SettingsTextInput
                    instanceId="imap-port-connection-form"
                    label={t`IMAP Port`}
                    type="number"
                    placeholder="993"
                    value={field?.value ? field.value : 993}
                    onChange={(value) =>
                      field.onChange(handlePortChange(value))
                    }
                    error={fieldState.error?.message}
                  />
                )}
              />
            </StyledFieldGroup>

            <StyledFieldGroup>
              <Controller
                name="IMAP.connectionSecurity"
                control={control}
                render={({ field }) => (
                  <Select
                    label={t`IMAP Connection security`}
                    options={[
                      { label: 'None', value: 'NONE' },
                      { label: 'STARTTLS', value: 'STARTTLS' },
                      { label: 'SSL/TLS', value: 'SSL_TLS' },
                    ]}
                    value={field.value}
                    onChange={field.onChange}
                    dropdownId="imap-connection-security-dropdown"
                  />
                )}
              />
            </StyledFieldGroup>
          </StyledFieldRow>
        </StyledConnectionSection>

        <StyledConnectionSection>
          <StyledSectionHeader>
            <StyledSectionTitle>{t`SMTP Configuration`}</StyledSectionTitle>
            <StyledSectionDescription>
              {t`Configure SMTP settings to send emails from your account.`}{' '}
              {t`Gmail: smtp.gmail.com, port 465, SSL/TLS.`}{' '}
              {t`Leave blank if you don't need to send emails.`}
            </StyledSectionDescription>
          </StyledSectionHeader>

          <Controller
            name="SMTP.host"
            control={control}
            render={({ field, fieldState }) => (
              <SettingsTextInput
                instanceId="smtp-host-connection-form"
                label={t`SMTP Server`}
                placeholder={t`smtp.gmail.com`}
                value={field.value || ''}
                onChange={field.onChange}
                error={fieldState.error?.message}
              />
            )}
          />

          <Controller
            name="SMTP.username"
            control={control}
            render={({ field, fieldState }) => (
              <SettingsTextInput
                instanceId="smtp-username-connection-form"
                label={t`SMTP Username`}
                placeholder={t`john.doe`}
                type="text"
                value={field.value || ''}
                onChange={field.onChange}
                error={fieldState.error?.message}
              />
            )}
          />

          <SettingsAccountsPasswordController
            protocol="SMTP"
            label={t`SMTP Password (App Password)`}
            control={control}
            disabled={isPasswordInputDisabled('SMTP')}
            onUnlock={() =>
              setIsProtocolPasswordBeingEdited((prev) => ({
                ...prev,
                SMTP: true,
              }))
            }
          />

          <StyledFieldRow>
            <StyledFieldGroup>
              <Controller
                name="SMTP.port"
                control={control}
                render={({ field, fieldState }) => (
                  <SettingsTextInput
                    instanceId="smtp-port-connection-form"
                    label={t`SMTP Port`}
                    type="number"
                    placeholder="587"
                    value={field?.value ? field.value : 587}
                    onChange={(value) =>
                      field.onChange(handlePortChange(value))
                    }
                    error={fieldState.error?.message}
                  />
                )}
              />
            </StyledFieldGroup>

            <StyledFieldGroup>
              <Controller
                name="SMTP.connectionSecurity"
                control={control}
                render={({ field }) => (
                  <Select
                    label={t`SMTP Connection security`}
                    options={[
                      { label: 'None', value: 'NONE' },
                      { label: 'STARTTLS', value: 'STARTTLS' },
                      { label: 'SSL/TLS', value: 'SSL_TLS' },
                    ]}
                    value={field.value}
                    onChange={field.onChange}
                    dropdownId="smtp-connection-security-dropdown"
                  />
                )}
              />
            </StyledFieldGroup>
          </StyledFieldRow>
        </StyledConnectionSection>

        <StyledConnectionSection>
          <StyledSectionHeader>
            <StyledSectionTitle>{t`CalDAV Configuration`}</StyledSectionTitle>
            <StyledSectionDescription>
              {t`Configure CalDAV settings to sync your calendar events.`}{' '}
              {t`Google: paste the full URL https://apidata.googleusercontent.com/caldav/v2/YOUR-EMAIL/events (not just a hostname).`}{' '}
              {t`Leave blank if you don't need calendar sync.`}
            </StyledSectionDescription>
          </StyledSectionHeader>

          <Controller
            name="CALDAV.host"
            control={control}
            render={({ field, fieldState }) => (
              <SettingsTextInput
                instanceId="caldav-host-connection-form"
                label={t`CalDAV Server`}
                placeholder={t`https://apidata.googleusercontent.com/caldav/v2/you@company.com/events`}
                value={field.value || ''}
                onChange={field.onChange}
                error={fieldState.error?.message}
              />
            )}
          />

          <Controller
            name="CALDAV.username"
            control={control}
            render={({ field, fieldState }) => (
              <SettingsTextInput
                instanceId="caldav-username-connection-form"
                label={t`CalDAV Username`}
                placeholder={t`john.doe`}
                required={false}
                value={field.value || ''}
                onChange={field.onChange}
                error={fieldState.error?.message}
              />
            )}
          />

          <SettingsAccountsPasswordController
            protocol="CALDAV"
            label={t`CalDAV Password (App Password)`}
            control={control}
            disabled={isPasswordInputDisabled('CALDAV')}
            onUnlock={() =>
              setIsProtocolPasswordBeingEdited((prev) => ({
                ...prev,
                CALDAV: true,
              }))
            }
          />
        </StyledConnectionSection>
      </StyledFormContainer>
      )}
    </Section>
  );
};
