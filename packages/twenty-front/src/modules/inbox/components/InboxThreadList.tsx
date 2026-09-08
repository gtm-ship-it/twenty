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
import { type InboxPipeline } from '@/inbox/types/InboxPipeline';
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
  align-items: center;
  background: ${themeCssVariables.background.primary};
  border-radius: ${themeCssVariables.border.radius.sm};
  box-shadow: -8px 0 8px ${themeCssVariables.background.primary};
  display: flex;
  gap: ${themeCssVariables.spacing[1]};
  opacity: 0;
  padding: ${themeCssVariables.spacing[1]};
  pointer-events: none;
  position: absolute;
  right: ${themeCssVariables.spacing[1]};
  top: 50%;
  transform: translateY(-50%);
  z-index: 2;
`;

const StyledPipelineMenu = styled.div`
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  box-shadow: ${themeCssVariables.boxShadow.strong};
  display: flex;
  flex-direction: column;
  position: absolute;
  right: 0;
  top: calc(100% + 4px);
  z-index: 5;
`;

const StyledPipelineMenuItem = styled.button`
  background: transparent;
  border: none;
  color: ${themeCssVariables.font.color.primary};
  cursor: pointer;
  font-family: inherit;
  font-size: ${themeCssVariables.font.size.sm};
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};
  text-align: left;
  white-space: nowrap;

  &:hover {
    background: ${themeCssVariables.background.transparent.light};
  }
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
  searchTerm: string;
  pipelines: InboxPipeline[];
  onAddToPipeline: (threadId: string, pipelineId: string) => void;
};

export const InboxThreadList = ({
  connectedAccountId,
  connectedAccountHandle,
  searchTerm,
  pipelines,
  onAddToPipeline,
}: InboxThreadListProps) => {
  const {
    threads,
    totalNumberOfThreads,
    firstQueryLoading,
    isFetchingMore,
    fetchMoreRecords,
  } = useInboxThreads(
    [connectedAccountId],
    TIMELINE_THREADS_DEFAULT_PAGE_SIZE,
    searchTerm,
  );

  const [createLeadDefaultValues, setCreateLeadDefaultValues] =
    useState<CreateLeadDefaultValues | null>(null);

  const [pipelineMenuThreadId, setPipelineMenuThreadId] = useState<
    string | null
  >(null);

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

  const visibleThreads = threads;

  return (
    <StyledContainer>
      <Section>
        <ActivityList>
          {visibleThreads.map((thread) => (
            <StyledRowWrapper key={thread.id}>
              <EmailThreadPreview thread={thread} />
              <StyledCreateLeadButtonContainer className="inbox-create-lead-action">
                {pipelines.length > 0 && (
                  <Button
                    title={t`To pipeline`}
                    size="small"
                    variant="secondary"
                    onClick={() =>
                      setPipelineMenuThreadId(
                        pipelineMenuThreadId === thread.id ? null : thread.id,
                      )
                    }
                  />
                )}
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
                {pipelineMenuThreadId === thread.id && (
                  <StyledPipelineMenu>
                    {pipelines.map((pipeline) => (
                      <StyledPipelineMenuItem
                        key={pipeline.id}
                        type="button"
                        onClick={() => {
                          onAddToPipeline(thread.id, pipeline.id);
                          setPipelineMenuThreadId(null);
                        }}
                      >
                        {pipeline.name}
                      </StyledPipelineMenuItem>
                    ))}
                  </StyledPipelineMenu>
                )}
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
