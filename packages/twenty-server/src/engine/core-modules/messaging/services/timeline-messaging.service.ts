import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import {
  MessageChannelVisibility,
  MessageParticipantRole,
} from 'twenty-shared/types';
import {
  In,
  type ObjectLiteral,
  type Repository,
  type SelectQueryBuilder,
} from 'typeorm';

import { FileUrlService } from 'src/engine/core-modules/file/file-url/file-url.service';
import { type TimelineThreadDTO } from 'src/engine/core-modules/messaging/dtos/timeline-thread.dto';
import { UserWorkspaceEntity } from 'src/engine/core-modules/user-workspace/user-workspace.entity';
import { ConnectedAccountEntity } from 'src/engine/metadata-modules/connected-account/entities/connected-account.entity';
import { MessageChannelEntity } from 'src/engine/metadata-modules/message-channel/entities/message-channel.entity';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';
import { type MessageParticipantWorkspaceEntity } from 'src/modules/messaging/common/standard-objects/message-participant.workspace-entity';
import { type MessageThreadWorkspaceEntity } from 'src/modules/messaging/common/standard-objects/message-thread.workspace-entity';
import { type WorkspaceMemberWorkspaceEntity } from 'src/modules/workspace-member/standard-objects/workspace-member.workspace-entity';

// Tope de hilos que una búsqueda puede resolver antes de paginar.
const SEARCH_MATCHING_THREADS_LIMIT = 2000;

@Injectable()
export class TimelineMessagingService {
  constructor(
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
    @InjectRepository(MessageChannelEntity)
    private readonly messageChannelRepository: Repository<MessageChannelEntity>,
    @InjectRepository(ConnectedAccountEntity)
    private readonly connectedAccountRepository: Repository<ConnectedAccountEntity>,
    @InjectRepository(UserWorkspaceEntity)
    private readonly userWorkspaceRepository: Repository<UserWorkspaceEntity>,
    private readonly fileUrlService: FileUrlService,
  ) {}

  public async getAndCountMessageThreads(
    personIds: string[],
    workspaceId: string,
    offset: number,
    pageSize: number,
  ): Promise<{
    messageThreads: Omit<
      TimelineThreadDTO,
      | 'firstParticipant'
      | 'lastTwoParticipants'
      | 'participantCount'
      | 'read'
      | 'visibility'
    >[];
    totalNumberOfThreads: number;
  }> {
    const authContext = buildSystemAuthContext(workspaceId);

    return this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const messageThreadRepository =
          await this.globalWorkspaceOrmManager.getRepository<MessageThreadWorkspaceEntity>(
            workspaceId,
            'messageThread',
          );

        const totalNumberOfThreads = await messageThreadRepository
          .createQueryBuilder('messageThread')
          .innerJoin('messageThread.messages', 'messages')
          .innerJoin('messages.messageParticipants', 'messageParticipants')
          .where('messageParticipants.personId IN(:...personIds)', {
            personIds,
          })
          .groupBy('messageThread.id')
          .getCount();

        const threadIdsQuery = await messageThreadRepository
          .createQueryBuilder('messageThread')
          .select('messageThread.id', 'id')
          .addSelect('MAX(messages.receivedAt)', 'max_received_at')
          .innerJoin('messageThread.messages', 'messages')
          .innerJoin('messages.messageParticipants', 'messageParticipants')
          .where('messageParticipants.personId IN (:...personIds)', {
            personIds,
          })
          .groupBy('messageThread.id')
          .orderBy('max_received_at', 'DESC')
          .offset(offset)
          .limit(pageSize)
          .getRawMany();

        const messageThreadIds = threadIdsQuery.map((thread) => thread.id);

        const messageThreads = await messageThreadRepository.find({
          where: {
            id: In(messageThreadIds),
          },
          order: {
            messages: {
              receivedAt: 'DESC',
            },
          },
          relations: ['messages'],
        });

        return {
          messageThreads: messageThreads.map((messageThread) => {
            const lastMessage = messageThread.messages[0];
            const firstMessage =
              messageThread.messages[messageThread.messages.length - 1];

            return {
              id: messageThread.id,
              subject: firstMessage.subject ?? '',
              lastMessageBody: lastMessage.text ?? '',
              lastMessageReceivedAt: lastMessage.receivedAt ?? new Date(),
              numberOfMessagesInThread: messageThread.messages.length,
              lastMessageIsDraft: lastMessage.isDraft ?? false,
            };
          }),
          totalNumberOfThreads,
        };
      },
      authContext,
    );
  }

  public async verifyConnectedAccountOwnership(
    connectedAccountId: string,
    userWorkspaceId: string,
    workspaceId: string,
  ): Promise<boolean> {
    const connectedAccount = await this.connectedAccountRepository.findOne({
      where: { id: connectedAccountId, workspaceId, userWorkspaceId },
    });

    return connectedAccount !== null;
  }

  public async getMessageChannelIdsForConnectedAccounts(
    connectedAccountIds: string[],
    userWorkspaceId: string,
    workspaceId: string,
  ): Promise<string[]> {
    if (connectedAccountIds.length === 0) {
      return [];
    }

    // Ownership gate: solo cuentas del propio usuario.
    const ownedAccounts = await this.connectedAccountRepository.find({
      where: { id: In(connectedAccountIds), workspaceId, userWorkspaceId },
      select: { id: true },
    });

    if (ownedAccounts.length === 0) {
      return [];
    }

    const messageChannels = await this.messageChannelRepository.find({
      where: {
        connectedAccountId: In(ownedAccounts.map((account) => account.id)),
        workspaceId,
      },
      select: { id: true },
    });

    return messageChannels.map((messageChannel) => messageChannel.id);
  }

  public async getMessageChannelIdsForConnectedAccount(
    connectedAccountId: string,
    userWorkspaceId: string,
    workspaceId: string,
  ): Promise<string[]> {
    // Ownership gate: only the account's own user can list its channels.
    const connectedAccount = await this.connectedAccountRepository.findOne({
      where: { id: connectedAccountId, workspaceId, userWorkspaceId },
    });

    if (!connectedAccount) {
      return [];
    }

    const messageChannels = await this.messageChannelRepository.find({
      where: { connectedAccountId, workspaceId },
    });

    return messageChannels.map((messageChannel) => messageChannel.id);
  }

  public async getAndCountMessageThreadsForMessageChannels(
    messageChannelIds: string[],
    workspaceId: string,
    offset: number,
    pageSize: number,
    searchTerm?: string,
  ): Promise<{
    messageThreads: Omit<
      TimelineThreadDTO,
      | 'firstParticipant'
      | 'lastTwoParticipants'
      | 'participantCount'
      | 'read'
      | 'visibility'
    >[];
    totalNumberOfThreads: number;
  }> {
    if (messageChannelIds.length === 0) {
      return { messageThreads: [], totalNumberOfThreads: 0 };
    }

    const authContext = buildSystemAuthContext(workspaceId);

    return this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const messageThreadRepository =
          await this.globalWorkspaceOrmManager.getRepository<MessageThreadWorkspaceEntity>(
            workspaceId,
            'messageThread',
          );

        // Búsqueda tipo Gmail: asunto, cuerpo, y nombre/correo de participantes.
        // Se resuelven primero los hilos que coinciden y luego se filtra por id:
        // meter los joins de participantes en las queries agregadas rompe el COUNT.
        const trimmedSearchTerm = searchTerm?.trim();
        const hasSearch =
          trimmedSearchTerm !== undefined && trimmedSearchTerm.length > 0;

        let matchingThreadIds: string[] = [];

        if (hasSearch) {
          const searchPattern = `%${trimmedSearchTerm}%`;

          const messageParticipantRepository =
            await this.globalWorkspaceOrmManager.getRepository<MessageParticipantWorkspaceEntity>(
              workspaceId,
              'messageParticipant',
            );

          const [contentMatches, participantMatches] = await Promise.all([
            messageThreadRepository
              .createQueryBuilder('messageThread')
              .select('DISTINCT messageThread.id', 'id')
              .innerJoin('messageThread.messages', 'messages')
              .where(
                '(messages.subject ILIKE :searchPattern OR messages.text ILIKE :searchPattern)',
                { searchPattern },
              )
              .limit(SEARCH_MATCHING_THREADS_LIMIT)
              .getRawMany<{ id: string }>(),
            messageParticipantRepository
              .createQueryBuilder('messageParticipant')
              .select('DISTINCT message."messageThreadId"', 'id')
              .innerJoin('messageParticipant.message', 'message')
              .where(
                '(messageParticipant.handle ILIKE :searchPattern OR messageParticipant."displayName" ILIKE :searchPattern)',
                { searchPattern },
              )
              .limit(SEARCH_MATCHING_THREADS_LIMIT)
              .getRawMany<{ id: string | null }>(),
          ]);

          matchingThreadIds = [
            ...new Set(
              [...contentMatches, ...participantMatches]
                .map((row) => row.id)
                .filter((id): id is string => id !== null && id !== undefined),
            ),
          ];

          if (matchingThreadIds.length === 0) {
            return { messageThreads: [], totalNumberOfThreads: 0 };
          }
        }

        const applySearchFilter = <Entity extends ObjectLiteral>(
          queryBuilder: SelectQueryBuilder<Entity>,
        ): SelectQueryBuilder<Entity> =>
          hasSearch
            ? queryBuilder.andWhere(
                'messageThread.id IN (:...matchingThreadIds)',
                { matchingThreadIds },
              )
            : queryBuilder;

        const totalNumberOfThreads = await applySearchFilter(
          messageThreadRepository
            .createQueryBuilder('messageThread')
            .innerJoin('messageThread.messages', 'messages')
            .innerJoin(
              'messages.messageChannelMessageAssociations',
              'associations',
            )
            .where('associations.messageChannelId IN(:...messageChannelIds)', {
              messageChannelIds,
            }),
        )
          .groupBy('messageThread.id')
          .getCount();

        const threadIdsQuery = await applySearchFilter(
          messageThreadRepository
            .createQueryBuilder('messageThread')
            .select('messageThread.id', 'id')
            .addSelect('MAX(messages.receivedAt)', 'max_received_at')
            .innerJoin('messageThread.messages', 'messages')
            .innerJoin(
              'messages.messageChannelMessageAssociations',
              'associations',
            )
            .where('associations.messageChannelId IN (:...messageChannelIds)', {
              messageChannelIds,
            }),
        )
          .groupBy('messageThread.id')
          .orderBy('max_received_at', 'DESC')
          .offset(offset)
          .limit(pageSize)
          .getRawMany();

        const messageThreadIds = threadIdsQuery.map((thread) => thread.id);

        const messageThreads = await messageThreadRepository.find({
          where: {
            id: In(messageThreadIds),
          },
          order: {
            messages: {
              receivedAt: 'DESC',
            },
          },
          relations: ['messages'],
        });

        return {
          messageThreads: messageThreads.map((messageThread) => {
            const lastMessage = messageThread.messages[0];
            const firstMessage =
              messageThread.messages[messageThread.messages.length - 1];

            return {
              id: messageThread.id,
              subject: firstMessage.subject ?? '',
              lastMessageBody: lastMessage.text ?? '',
              lastMessageReceivedAt: lastMessage.receivedAt ?? new Date(),
              numberOfMessagesInThread: messageThread.messages.length,
              lastMessageIsDraft: lastMessage.isDraft ?? false,
            };
          }),
          totalNumberOfThreads,
        };
      },
      authContext,
    );
  }

  public async getThreadParticipantsByThreadId(
    messageThreadIds: string[],
    workspaceId: string,
  ): Promise<{
    [key: string]: MessageParticipantWorkspaceEntity[];
  }> {
    const authContext = buildSystemAuthContext(workspaceId);

    return this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const messageParticipantRepository =
          await this.globalWorkspaceOrmManager.getRepository<MessageParticipantWorkspaceEntity>(
            workspaceId,
            'messageParticipant',
          );

        const threadParticipants = await messageParticipantRepository
          .createQueryBuilder()
          .select('messageParticipant')
          .addSelect('message.messageThreadId')
          .addSelect('message.receivedAt')
          .leftJoinAndSelect('messageParticipant.person', 'person')
          .leftJoinAndSelect(
            'messageParticipant.workspaceMember',
            'workspaceMember',
          )
          .leftJoin('messageParticipant.message', 'message')
          .where('message.messageThreadId = ANY(:messageThreadIds)', {
            messageThreadIds,
          })
          .andWhere('messageParticipant.role = :role', {
            role: MessageParticipantRole.FROM,
          })
          .orderBy('message.messageThreadId')
          .distinctOn(['message.messageThreadId', 'messageParticipant.handle'])
          .getMany();

        const orderedThreadParticipants = threadParticipants.sort(
          (a, b) =>
            (a.message.receivedAt ?? new Date()).getTime() -
            (b.message.receivedAt ?? new Date()).getTime(),
        );

        const threadParticipantPromises = orderedThreadParticipants.map(
          async (threadParticipant) => {
            const personAvatarFileUrl =
              await this.fileUrlService.signFirstFilesFieldFileUrl({
                filesFieldValue: threadParticipant.person?.avatarFile,
                workspaceId,
              });

            return {
              ...threadParticipant,
              person: {
                id: threadParticipant.person?.id,
                name: {
                  //oxlint-disable-next-line
                  //@ts-ignore
                  firstName: threadParticipant.person?.nameFirstName,
                  //oxlint-disable-next-line
                  //@ts-ignore
                  lastName: threadParticipant.person?.nameLastName,
                },
                avatarUrl:
                  personAvatarFileUrl || threadParticipant.person?.avatarUrl,
              },
              workspaceMember: {
                id: threadParticipant.workspaceMember?.id,
                name: {
                  //oxlint-disable-next-line
                  //@ts-ignore
                  firstName: threadParticipant.workspaceMember?.nameFirstName,
                  //oxlint-disable-next-line
                  //@ts-ignore
                  lastName: threadParticipant.workspaceMember?.nameLastName,
                },
                avatarUrl: threadParticipant.workspaceMember?.avatarUrl,
              },
            };
          },
        );

        const threadParticipantsWithCompositeFields = await Promise.all(
          threadParticipantPromises,
        );

        return threadParticipantsWithCompositeFields.reduce(
          (threadParticipantsAcc, threadParticipant) => {
            if (!threadParticipant.message.messageThreadId)
              return threadParticipantsAcc;

            if (
              // @ts-expect-error legacy noImplicitAny
              !threadParticipantsAcc[threadParticipant.message.messageThreadId]
            )
              // @ts-expect-error legacy noImplicitAny
              threadParticipantsAcc[threadParticipant.message.messageThreadId] =
                [];

            // @ts-expect-error legacy noImplicitAny
            threadParticipantsAcc[
              threadParticipant.message.messageThreadId
            ].push(threadParticipant);

            return threadParticipantsAcc;
          },
          {},
        );
      },
      authContext,
    );
  }

  public async getThreadVisibilityByThreadId(
    messageThreadIds: string[],
    workspaceMemberId: string,
    workspaceId: string,
  ): Promise<{
    [key: string]: MessageChannelVisibility;
  }> {
    const authContext = buildSystemAuthContext(workspaceId);

    return this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const workspaceMemberRepository =
          await this.globalWorkspaceOrmManager.getRepository<WorkspaceMemberWorkspaceEntity>(
            workspaceId,
            'workspaceMember',
            { shouldBypassPermissionChecks: true },
          );

        const currentMember = await workspaceMemberRepository.findOne({
          where: { id: workspaceMemberId },
          select: { userId: true },
        });

        if (!currentMember) {
          return {};
        }

        const currentUserWorkspace = await this.userWorkspaceRepository.findOne(
          {
            where: { userId: currentMember.userId, workspaceId },
            select: { id: true },
          },
        );

        if (!currentUserWorkspace) {
          return {};
        }

        const currentUserWorkspaceId = currentUserWorkspace.id;

        const messageThreadRepository =
          await this.globalWorkspaceOrmManager.getRepository<MessageThreadWorkspaceEntity>(
            workspaceId,
            'messageThread',
          );

        const threadChannelRows = await messageThreadRepository
          .createQueryBuilder()
          .select('messageThread.id', 'id')
          .addSelect(
            'messageChannelMessageAssociation.messageChannelId',
            'messageChannelId',
          )
          .leftJoin('messageThread.messages', 'message')
          .leftJoin(
            'message.messageChannelMessageAssociations',
            'messageChannelMessageAssociation',
          )
          .where('messageThread.id = ANY(:messageThreadIds)', {
            messageThreadIds,
          })
          .getRawMany<{ id: string; messageChannelId: string | null }>();

        const allMessageChannelIds = [
          ...new Set(
            threadChannelRows
              .map((row) => row.messageChannelId)
              .filter((id): id is string => id !== null && id !== undefined),
          ),
        ];

        if (allMessageChannelIds.length === 0) {
          return {};
        }

        const messageChannels = await this.messageChannelRepository.find({
          where: { id: In(allMessageChannelIds), workspaceId },
          select: { id: true, visibility: true, connectedAccountId: true },
        });

        const allConnectedAccountIds = [
          ...new Set(
            messageChannels.map((channel) => channel.connectedAccountId),
          ),
        ];

        const ownedAccountIds = new Set(
          (
            await this.connectedAccountRepository.find({
              where: {
                id: In(allConnectedAccountIds),
                userWorkspaceId: currentUserWorkspaceId,
              },
              select: { id: true },
            })
          ).map((account) => account.id),
        );

        const channelVisibilityMap = new Map(
          messageChannels.map((channel) => [
            channel.id,
            ownedAccountIds.has(channel.connectedAccountId)
              ? MessageChannelVisibility.SHARE_EVERYTHING
              : channel.visibility,
          ]),
        );

        const visibilityValues = Object.values(MessageChannelVisibility);

        const threadVisibilityByThreadId: {
          [key: string]: MessageChannelVisibility;
        } = {};

        for (const { id: threadId, messageChannelId } of threadChannelRows) {
          if (!messageChannelId) continue;

          const channelVisibility = channelVisibilityMap.get(messageChannelId);

          if (!channelVisibility) continue;

          threadVisibilityByThreadId[threadId] =
            visibilityValues[
              Math.max(
                visibilityValues.indexOf(channelVisibility),
                visibilityValues.indexOf(
                  threadVisibilityByThreadId[threadId] ??
                    MessageChannelVisibility.METADATA,
                ),
              )
            ];
        }

        return threadVisibilityByThreadId;
      },
      authContext,
    );
  }
}
