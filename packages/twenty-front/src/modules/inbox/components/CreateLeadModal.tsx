import { styled } from '@linaria/react';
import { t } from '@lingui/core/macro';
import { useState } from 'react';
import { CoreObjectNameSingular } from 'twenty-shared/types';
import { Button } from 'twenty-ui/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { H2Title } from 'twenty-ui/typography';

import { useCreateOneRecord } from '@/object-record/hooks/useCreateOneRecord';
import { useLazyFindManyRecords } from '@/object-record/hooks/useLazyFindManyRecords';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { SettingsTextInput } from '@/ui/input/components/SettingsTextInput';

const StyledOverlay = styled.div`
  align-items: center;
  background: ${themeCssVariables.background.overlayPrimary};
  display: flex;
  inset: 0;
  justify-content: center;
  position: fixed;
  z-index: 1000;
`;

const StyledCard = styled.div`
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.md};
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[4]};
  max-height: 90vh;
  overflow-y: auto;
  padding: ${themeCssVariables.spacing[6]};
  width: 400px;
`;

const StyledFieldsColumn = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[3]};
`;

const StyledButtonsRow = styled.div`
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
  justify-content: flex-end;
`;

export type CreateLeadDefaultValues = {
  firstName: string;
  lastName: string;
  email: string;
  companyName: string;
  companyDomain: string;
};

type CreateLeadModalProps = {
  defaultValues: CreateLeadDefaultValues;
  onClose: () => void;
};

export const CreateLeadModal = ({
  defaultValues,
  onClose,
}: CreateLeadModalProps) => {
  const [firstName, setFirstName] = useState(defaultValues.firstName);
  const [lastName, setLastName] = useState(defaultValues.lastName);
  const [email, setEmail] = useState(defaultValues.email);
  const [phone, setPhone] = useState('');
  const [companyName, setCompanyName] = useState(defaultValues.companyName);
  const [companyDomain, setCompanyDomain] = useState(
    defaultValues.companyDomain,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { enqueueSuccessSnackBar, enqueueErrorSnackBar } = useSnackBar();

  const { createOneRecord: createCompany } = useCreateOneRecord({
    objectNameSingular: CoreObjectNameSingular.Company,
  });
  const { createOneRecord: createPerson } = useCreateOneRecord({
    objectNameSingular: CoreObjectNameSingular.Person,
  });
  const { createOneRecord: createOpportunity } = useCreateOneRecord({
    objectNameSingular: CoreObjectNameSingular.Opportunity,
  });

  const { findManyRecordsLazy: findPeopleByEmail } = useLazyFindManyRecords({
    objectNameSingular: CoreObjectNameSingular.Person,
    filter: {
      emails: {
        primaryEmail: {
          eq: email.trim().toLowerCase(),
        },
      },
    },
    limit: 1,
  });

  const handleSubmit = async () => {
    if (!email.trim() || isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    try {
      const { records: existingPeople } = await findPeopleByEmail();
      const existingPerson = existingPeople?.[0] ?? null;

      let companyId: string | null =
        (existingPerson?.companyId as string | undefined) ?? null;

      if (!companyId && companyName.trim()) {
        const company = await createCompany({
          name: companyName.trim(),
          ...(companyDomain.trim()
            ? {
                domainName: {
                  primaryLinkUrl: companyDomain.trim().startsWith('http')
                    ? companyDomain.trim()
                    : `https://${companyDomain.trim()}`,
                },
              }
            : {}),
        });

        companyId = (company?.id as string | undefined) ?? null;
      }

      let personId = (existingPerson?.id as string | undefined) ?? null;

      if (!personId) {
        const person = await createPerson({
          name: {
            firstName: firstName.trim(),
            lastName: lastName.trim(),
          },
          emails: {
            primaryEmail: email.trim().toLowerCase(),
          },
          ...(phone.trim()
            ? {
                phones: {
                  primaryPhoneNumber: phone.trim(),
                },
              }
            : {}),
          ...(companyId ? { companyId } : {}),
        });

        personId = (person?.id as string | undefined) ?? null;
      }

      const opportunityName =
        `${firstName.trim()} ${lastName.trim()}`.trim() ||
        companyName.trim() ||
        email.trim();

      await createOpportunity({
        name: opportunityName,
        stage: 'NEW_LEAD',
        ...(companyId ? { companyId } : {}),
        ...(personId ? { pointOfContactId: personId } : {}),
      });

      enqueueSuccessSnackBar({
        message: existingPerson
          ? t`Lead created in the pipeline (existing contact reused)`
          : t`Lead created in the pipeline`,
      });

      onClose();
    } catch (error) {
      enqueueErrorSnackBar({
        message:
          error instanceof Error ? error.message : t`Could not create lead`,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <StyledOverlay onClick={onClose}>
      <StyledCard onClick={(event) => event.stopPropagation()}>
        <H2Title
          title={t`Create lead`}
          description={t`A company, a person and a "New lead" card will be created in the pipeline.`}
        />
        <StyledFieldsColumn>
          <SettingsTextInput
            instanceId="create-lead-first-name"
            label={t`First name`}
            value={firstName}
            onChange={setFirstName}
            fullWidth
          />
          <SettingsTextInput
            instanceId="create-lead-last-name"
            label={t`Last name`}
            value={lastName}
            onChange={setLastName}
            fullWidth
          />
          <SettingsTextInput
            instanceId="create-lead-email"
            label={t`Email`}
            value={email}
            onChange={setEmail}
            fullWidth
          />
          <SettingsTextInput
            instanceId="create-lead-phone"
            label={t`Phone`}
            placeholder={t`Optional`}
            value={phone}
            onChange={setPhone}
            fullWidth
          />
          <SettingsTextInput
            instanceId="create-lead-company-name"
            label={t`Company name`}
            value={companyName}
            onChange={setCompanyName}
            fullWidth
          />
          <SettingsTextInput
            instanceId="create-lead-company-domain"
            label={t`Company domain`}
            placeholder={t`acme.com`}
            value={companyDomain}
            onChange={setCompanyDomain}
            fullWidth
          />
        </StyledFieldsColumn>
        <StyledButtonsRow>
          <Button title={t`Cancel`} variant="secondary" onClick={onClose} />
          <Button
            title={isSubmitting ? t`Creating...` : t`Create lead`}
            accent="blue"
            disabled={!email.trim() || isSubmitting}
            onClick={handleSubmit}
          />
        </StyledButtonsRow>
      </StyledCard>
    </StyledOverlay>
  );
};
