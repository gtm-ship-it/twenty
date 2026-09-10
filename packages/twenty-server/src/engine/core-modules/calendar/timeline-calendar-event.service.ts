import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import omit from 'lodash.omit';
import { FIELD_RESTRICTED_ADDITIONAL_PERMISSIONS_REQUIRED } from 'twenty-shared/constants';
import { isDefined } from 'twenty-shared/utils';
import { Any, In, MoreThanOrEqual, type Repository } from 'typeorm';

import { CalendarChannelVisibility } from 'twenty-shared/types';
import { TIMELINE_CALENDAR_EVENTS_DEFAULT_PAGE_SIZE } from 'src/engine/core-modules/calendar/constants/calendar.constants';
import { type TimelineCalendarEventsWithTotalDTO } from 'src/engine/core-modules/calendar/dtos/timeline-calendar-events-with-total.dto';
import { FileUrlService } from 'src/engine/core-modules/file/file-url/file-url.service';
import { RelatedPersonIdsService } from 'src/engine/core-modules/related-person-ids/services/related-person-ids.service';
import { CalendarChannelEntity } from 'src/engine/metadata-modules/calendar-channel/entities/calendar-channel.entity';
import { ConnectedAccountEntity } from 'src/engine/metadata-modules/connected-account/entities/connected-account.entity';
import { UserWorkspaceEntity } from 'src/engine/core-modules/user-workspace/user-workspace.entity';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';
import { type CalendarEventWorkspaceEntity } from 'src/modules/calendar/common/standard-objects/calendar-event.workspace-entity';
import { type CallRecordingStatus } from 'src/modules/call-recording/common/enums/call-recording-status.enum';
import { type CallRecordingWorkspaceEntity } from 'src/modules/call-recording/standard-objects/call-recording.workspace-entity';
import { type WorkspaceMemberWorkspaceEntity } from 'src/modules/workspace-member/standard-objects/workspace-member.workspace-entity';

@Injectable()
export class TimelineCalendarEventService {
  constructor(
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
    @InjectRepository(CalendarChannelEntity)
    private readonly calendarChannelRepository: Repository<CalendarChannelEntity>,
    @InjectRepository(ConnectedAccountEntity)
    private readonly connectedAccountRepository: Repository<ConnectedAccountEntity>,
    @InjectRepository(UserWorkspaceEntity)
    private readonly userWorkspaceRepository: Repository<UserWorkspaceEntity>,
    private readonly relatedPersonIdsService: RelatedPersonIdsService,
    private readonly fileUrlService: FileUrlService,
  ) {}

  async getCalendarEventsFromPersonIds({
    currentWorkspaceMemberId,
    personIds,
    workspaceId,
    page = 1,
    pageSize = TIMELINE_CALENDAR_EVENTS_DEFAULT_PAGE_SIZE,
  }: {
    currentWorkspaceMemberId: string;
    personIds: string[];
    workspaceId: string;
    page: number;
    pageSize: number;
  }): Promise<TimelineCalendarEventsWithTotalDTO> {
    return this.getCalendarEventsByFilter({
      currentWorkspaceMemberId,
      workspaceId,
      page,
      pageSize,
      eventWhere: { calendarEventParticipants: { personId: Any(personIds) } },
      relatedPersonIds: personIds,
    });
  }

  /**
   * Eventos de las cuentas conectadas del propio usuario (vista Calendar del
   * modulo Email). Solo devuelve cuentas cuyo dueño es el usuario que pregunta.
   */
  async getCalendarEventsFromConnectedAccountIds({
    currentWorkspaceMemberId,
    userWorkspaceId,
    connectedAccountIds,
    workspaceId,
    page = 1,
    pageSize = TIMELINE_CALENDAR_EVENTS_DEFAULT_PAGE_SIZE,
  }: {
    currentWorkspaceMemberId: string;
    userWorkspaceId: string;
    connectedAccountIds: string[];
    workspaceId: string;
    page: number;
    pageSize: number;
  }): Promise<TimelineCalendarEventsWithTotalDTO> {
    if (connectedAccountIds.length === 0) {
      return {
        totalNumberOfCalendarEvents: 0,
        timelineCalendarEvents: [],
        relatedPersonIds: [],
      };
    }

    const ownedAccounts = await this.connectedAccountRepository.find({
      where: { id: In(connectedAccountIds), workspaceId, userWorkspaceId },
      select: { id: true },
    });

    if (ownedAccounts.length === 0) {
      return {
        totalNumberOfCalendarEvents: 0,
        timelineCalendarEvents: [],
        relatedPersonIds: [],
      };
    }

    const calendarChannels = await this.calendarChannelRepository.find({
      where: {
        connectedAccountId: In(ownedAccounts.map((account) => account.id)),
        workspaceId,
      },
      select: { id: true },
    });

    if (calendarChannels.length === 0) {
      return {
        totalNumberOfCalendarEvents: 0,
        timelineCalendarEvents: [],
        relatedPersonIds: [],
      };
    }

    // Agenda, no historial: desde el inicio del dia de hoy y hacia adelante.
    const startOfToday = new Date();

    startOfToday.setHours(0, 0, 0, 0);

    return this.getCalendarEventsByFilter({
      currentWorkspaceMemberId,
      workspaceId,
      page,
      pageSize,
      eventWhere: {
        calendarChannelEventAssociations: {
          calendarChannelId: Any(calendarChannels.map((c) => c.id)),
        },
        startsAt: MoreThanOrEqual(startOfToday),
      },
      relatedPersonIds: [],
      startsAtOrder: 'ASC',
    });
  }

  private async getCalendarEventsByFilter({
    currentWorkspaceMemberId,
    workspaceId,
    page,
    pageSize,
    eventWhere,
    relatedPersonIds,
    startsAtOrder = 'DESC',
  }: {
    currentWorkspaceMemberId: string;
    workspaceId: string;
    page: number;
    pageSize: number;
    eventWhere: Record<string, unknown>;
    relatedPersonIds: string[];
    startsAtOrder?: 'ASC' | 'DESC';
  }): Promise<TimelineCalendarEventsWithTotalDTO> {
    const authContext = buildSystemAuthContext(workspaceId);

    return this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const offset = (page - 1) * pageSize;

        // Runs under a system auth context, which resolves no role, so without
        // this the participant relations (person, workspaceMember) are read with
        // empty permissions and denied for everyone. Channel-level redaction of
        // title and description below is what gates the caller's access.
        // TODO run under the caller's role via resolveRolePermissionConfig instead
        // of bypassing, once roles that cannot read person degrade to a redacted
        // timeline rather than a denied one
        // https://github.com/twentyhq/core-team-issues/issues/2777
        const calendarEventRepository =
          await this.globalWorkspaceOrmManager.getRepository<CalendarEventWorkspaceEntity>(
            workspaceId,
            'calendarEvent',
            { shouldBypassPermissionChecks: true },
          );

        const totalNumberOfCalendarEvents = await calendarEventRepository.count(
          {
            where: eventWhere,
          },
        );

        const calendarEventIds = await calendarEventRepository.find({
          where: eventWhere,
          select: {
            id: true,
            startsAt: true,
          },
          skip: offset,
          take: pageSize,
          order: {
            startsAt: startsAtOrder,
          },
        });

        const ids = calendarEventIds.map(({ id }) => id);

        if (ids.length <= 0) {
          return {
            totalNumberOfCalendarEvents,
            timelineCalendarEvents: [],
            relatedPersonIds,
          };
        }

        const [events] = await calendarEventRepository.findAndCount({
          where: {
            id: Any(ids),
          },
          relations: {
            calendarEventParticipants: {
              person: true,
              workspaceMember: true,
            },
            calendarChannelEventAssociations: true,
          },
        });

        const callRecordingRepository =
          await this.globalWorkspaceOrmManager.getRepository<CallRecordingWorkspaceEntity>(
            workspaceId,
            'callRecording',
          );

        const callRecordings = await callRecordingRepository.find({
          where: {
            calendarEventId: Any(ids),
          },
          select: {
            id: true,
            status: true,
            applicationId: true,
            calendarEventId: true,
          },
        });

        const callRecordingsByCalendarEventId = callRecordings.reduce<
          Map<
            string,
            {
              id: string;
              status: CallRecordingStatus;
              applicationId: string | null;
            }[]
          >
        >((acc, callRecording) => {
          if (!isDefined(callRecording.calendarEventId)) {
            return acc;
          }

          const existing = acc.get(callRecording.calendarEventId) ?? [];

          existing.push({
            id: callRecording.id,
            status: callRecording.status,
            applicationId: callRecording.applicationId ?? null,
          });
          acc.set(callRecording.calendarEventId, existing);

          return acc;
        }, new Map());

        const allCalendarChannelIds = [
          ...new Set(
            events.flatMap((event) =>
              event.calendarChannelEventAssociations.map(
                (association) => association.calendarChannelId,
              ),
            ),
          ),
        ];

        const calendarChannels =
          allCalendarChannelIds.length > 0
            ? await this.calendarChannelRepository.find({
                where: { id: In(allCalendarChannelIds), workspaceId },
              })
            : [];

        // Resolve current user's userWorkspaceId (workspaceMember → userId → userWorkspace)
        const workspaceMemberRepo =
          await this.globalWorkspaceOrmManager.getRepository<WorkspaceMemberWorkspaceEntity>(
            workspaceId,
            'workspaceMember',
            { shouldBypassPermissionChecks: true },
          );

        const currentMember = await workspaceMemberRepo.findOne({
          where: { id: currentWorkspaceMemberId },
          select: { userId: true },
        });

        const currentUserWorkspaceId = currentMember
          ? ((
              await this.userWorkspaceRepository.findOne({
                where: { userId: currentMember.userId, workspaceId },
                select: { id: true },
              })
            )?.id ?? null)
          : null;

        const connectedAccountIds = [
          ...new Set(
            calendarChannels.map((channel) => channel.connectedAccountId),
          ),
        ];

        const ownedAccountIds =
          connectedAccountIds.length > 0 && currentUserWorkspaceId
            ? new Set(
                (
                  await this.connectedAccountRepository.find({
                    where: {
                      id: In(connectedAccountIds),
                      userWorkspaceId: currentUserWorkspaceId,
                    },
                    select: { id: true },
                  })
                ).map((a) => a.id),
              )
            : new Set<string>();

        // handle de la cuenta por canal: el front necesita saber de cual de
        // MIS buzones viene cada evento (y un evento puede estar en varios).
        const accountHandleById = new Map(
          (
            await this.connectedAccountRepository.find({
              where: {
                id: In(calendarChannels.map((c) => c.connectedAccountId)),
                workspaceId,
              },
              select: { id: true, handle: true },
            })
          ).map((account) => [account.id, account.handle]),
        );

        const calendarChannelMap = new Map(
          calendarChannels.map((channel) => [
            channel.id,
            {
              visibility: channel.visibility,
              isOwnedByCurrentUser: ownedAccountIds.has(
                channel.connectedAccountId,
              ),
              accountHandle:
                accountHandleById.get(channel.connectedAccountId) ?? '',
            },
          ]),
        );

        const orderedEvents = events.sort(
          (a, b) => ids.indexOf(a.id) - ids.indexOf(b.id),
        );

        const timelineCalendarEventPromises = orderedEvents.map(
          async (event) => {
            const participantPromises = event.calendarEventParticipants.map(
              async (participant) => {
                const personAvatarFileUrl =
                  await this.fileUrlService.signFirstFilesFieldFileUrl({
                    filesFieldValue: participant.person?.avatarFile,
                    workspaceId,
                  });

                return {
                  calendarEventId: event.id,
                  personId: participant.personId ?? null,
                  workspaceMemberId: participant.workspaceMemberId ?? null,
                  firstName:
                    participant.person?.name?.firstName ||
                    participant.workspaceMember?.name.firstName ||
                    '',
                  lastName:
                    participant.person?.name?.lastName ||
                    participant.workspaceMember?.name.lastName ||
                    '',
                  displayName:
                    participant.person?.name?.firstName ||
                    participant.person?.name?.lastName ||
                    participant.workspaceMember?.name.firstName ||
                    participant.workspaceMember?.name.lastName ||
                    participant.displayName ||
                    participant.handle ||
                    '',
                  avatarUrl:
                    personAvatarFileUrl ||
                    participant.person?.avatarUrl ||
                    participant.workspaceMember?.avatarUrl ||
                    '',
                  handle: participant.handle ?? '',
                };
              },
            );

            const participants = await Promise.all(participantPromises);

            const hasFullAccess = event.calendarChannelEventAssociations.some(
              (association) => {
                const channel = calendarChannelMap.get(
                  association.calendarChannelId,
                );

                return (
                  channel?.visibility === 'SHARE_EVERYTHING' ||
                  channel?.isOwnedByCurrentUser
                );
              },
            );

            const visibility = hasFullAccess
              ? CalendarChannelVisibility.SHARE_EVERYTHING
              : CalendarChannelVisibility.METADATA;

            const accountHandles = [
              ...new Set(
                event.calendarChannelEventAssociations
                  .map(
                    (association) =>
                      calendarChannelMap.get(association.calendarChannelId)
                        ?.accountHandle,
                  )
                  .filter(
                    (handle): handle is string =>
                      typeof handle === 'string' && handle.length > 0,
                  ),
              ),
            ];

            return {
              ...omit(event, [
                'calendarEventParticipants',
                'calendarChannelEventAssociations',
              ]),
              accountHandles,
              title:
                visibility === CalendarChannelVisibility.METADATA
                  ? FIELD_RESTRICTED_ADDITIONAL_PERMISSIONS_REQUIRED
                  : (event.title ?? ''),
              description:
                visibility === CalendarChannelVisibility.METADATA
                  ? FIELD_RESTRICTED_ADDITIONAL_PERMISSIONS_REQUIRED
                  : (event.description ?? ''),
              startsAt: event.startsAt as unknown as Date,
              endsAt: event.endsAt as unknown as Date,
              participants,
              callRecordings:
                callRecordingsByCalendarEventId.get(event.id) ?? [],
              visibility,
              location: event.location ?? '',
              conferenceSolution: event.conferenceSolution ?? '',
            };
          },
        );

        const timelineCalendarEvents = await Promise.all(
          timelineCalendarEventPromises,
        );

        return {
          totalNumberOfCalendarEvents,
          timelineCalendarEvents,
          relatedPersonIds,
        };
      },
      authContext,
    );
  }

  async getCalendarEventsFromObjectRecord({
    currentWorkspaceMemberId,
    objectNameSingular,
    recordId,
    workspaceId,
    page = 1,
    pageSize = TIMELINE_CALENDAR_EVENTS_DEFAULT_PAGE_SIZE,
  }: {
    currentWorkspaceMemberId: string;
    objectNameSingular: string;
    recordId: string;
    workspaceId: string;
    page: number;
    pageSize: number;
  }): Promise<TimelineCalendarEventsWithTotalDTO> {
    const personIds = await this.relatedPersonIdsService.getRelatedPersonIds({
      workspaceId,
      objectNameSingular,
      recordId,
    });

    if (personIds.length === 0) {
      return {
        totalNumberOfCalendarEvents: 0,
        timelineCalendarEvents: [],
        relatedPersonIds: [],
      };
    }

    return this.getCalendarEventsFromPersonIds({
      currentWorkspaceMemberId,
      personIds,
      workspaceId,
      page,
      pageSize,
    });
  }
}
