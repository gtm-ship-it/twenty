import { styled } from '@linaria/react';
import { t } from '@lingui/core/macro';
import { useState } from 'react';
import { Button } from 'twenty-ui/input';
import { Section } from 'twenty-ui/layout';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { ActivityList } from '@/activities/components/ActivityList';
import { CustomResolverFetchMoreLoader } from '@/activities/components/CustomResolverFetchMoreLoader';
import { SkeletonLoader } from '@/activities/components/SkeletonLoader';
import { EmailThreadPreview } from '@/activities/emails/components/EmailThreadPreview';
import { EmptyInboxPlaceholder } from '@/activities/emails/components/EmptyInboxPlaceholder';
import { TIMELINE_THREADS_DEFAULT_PAGE_SIZE } from '@/activities/emails/constants/Messaging';
import {
  CreateLeadModal,
  type CreateLeadDefaultValues,
} from '@/inbox/components/CreateLeadModal';
import { useInboxThreads } from '@/inbox/hooks/useInboxThreads';
import { type TimelineThread } from '~/generated/graphql';

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[6]};
  height: 100%;
  overflow: auto;
  padding: ${themeCssVariables.spacing[6]} ${themeCssVariables.spacing[6]}
    ${themeCssVariables.spacing[2]};
`;

const StyledRowWrapper = styled.div`
  position: relative;

  &:hover .inbox-create-lead-action {
    opacity: 1;
    pointer-events: auto;
  }
`;

const StyledCreateLeadButtonContainer = styled.div`
  opacity: 0;
  pointer-events: none;
  position: absolute;
  right: ${themeCssVariables.spacing[2]};
  top: 50%;
  transform: translateY(-50%);
  z-index: 2;
`;

const FREE_MAIL_DOMAINS = [
  'gmail.com',
  'googlemail.com',
  'hotmail.com',
  'outlook.com',
  'live.com',
  'yahoo.com',
  'icloud.com',
  'aol.com',
  'proton.me',
  'protonmail.com',
];

const getCreateLeadDefaultValues = (
  thread: TimelineThread,
  ownHandle: string,
): CreateLeadDefaultValues => {
  const candidates = [
    thread.firstParticipant,
    ...(thread.lastTwoParticipants ?? []),
  ].filter(
    (participant) =>
      participant !== null &&
      participant !== undefined &&
      participant.handle?.toLowerCase() !== ownHandle.toLowerCase(),
  );

  const contact = candidates[0] ?? thread.firstParticipant;

  const email = contact?.handle ?? '';
  const domain = email.includes('@') ? email.split('@')[1].toLowerCase() : '';
  const isFreeMailDomain = FREE_MAIL_DOMAINS.includes(domain);

  const displayNameParts = (contact?.displayName ?? '').trim().split(/\s+/);

  return {
    firstName: contact?.firstName || displayNameParts[0] || '',
    lastName:
      contact?.lastName || displayNameParts.slice(1).join(' ') || '',
    email,
    companyName:
      !isFreeMailDomain && domain
        ? domain.split('.')[0].charAt(0).toUpperCase() +
          domain.split('.')[0].slice(1)
        : '',
    companyDomain: !isFreeMailDomain ? domain : '',
  };
};

type InboxThreadListProps = {
  connectedAccountId: string;
  connectedAccountHandle: string;
};

export const InboxThreadList = ({
  connectedAccountId,
  connectedAccountHandle,
}: InboxThreadListProps) => {
  const {
    threads,
    totalNumberOfThreads,
    firstQueryLoading,
    isFetchingMore,
    fetchMoreRecords,
  } = useInboxThreads(connectedAccountId, TIMELINE_THREADS_DEFAULT_PAGE_SIZE);

  const [createLeadDefaultValues, setCreateLeadDefaultValues] =
    useState<CreateLeadDefaultValues | null>(null);

  if (firstQueryLoading) {
    return <SkeletonLoader />;
  }

  if (!threads?.length) {
    return (
      <StyledContainer>
        <EmptyInboxPlaceholder />
      </StyledContainer>
    );
  }

  const hasMoreThreads = threads.length < totalNumberOfThreads;

  const handleLastRowVisible = async () => {
    if (hasMoreThreads) {
      await fetchMoreRecords();
    }
  };

  return (
    <StyledContainer>
      <Section>
        <ActivityList>
          {threads.map((thread) => (
            <StyledRowWrapper key={thread.id}>
              <EmailThreadPreview thread={thread} />
              <StyledCreateLeadButtonContainer className="inbox-create-lead-action">
                <Button
                  title={t`Create lead`}
                  size="small"
                  variant="secondary"
                  onClick={() =>
                    setCreateLeadDefaultValues(
                      getCreateLeadDefaultValues(
                        thread,
                        connectedAccountHandle,
                      ),
                    )
                  }
                />
              </StyledCreateLeadButtonContainer>
            </StyledRowWrapper>
          ))}
        </ActivityList>
        <CustomResolverFetchMoreLoader
          loading={isFetchingMore}
          onLastRowVisible={handleLastRowVisible}
        />
      </Section>
      {createLeadDefaultValues && (
        <CreateLeadModal
          defaultValues={createLeadDefaultValues}
          onClose={() => setCreateLeadDefaultValues(null)}
        />
      )}
    </StyledContainer>
  );
};
