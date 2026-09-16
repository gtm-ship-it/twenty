import { UseFilters, UseGuards, UsePipes } from '@nestjs/common';
import { Args, ArgsType, Field, Mutation, Query } from '@nestjs/graphql';

import { ArrayMaxSize, IsString } from 'class-validator';
import { isNonEmptyString } from '@sniptt/guards';
import { isDefined } from 'twenty-shared/utils';

import { CoreResolver } from 'src/engine/api/graphql/graphql-config/decorators/core-resolver.decorator';
import { UUIDScalarType } from 'src/engine/api/graphql/workspace-schema-builder/graphql-types/scalars';
import {
  ATLAS_MAX_RECORDS_TO_RESOLVE,
  ATLAS_SCHEDULE_SPACING_MS,
} from 'src/engine/core-modules/atlas-calls/constants/atlas-calls.constants';
import { AtlasCallTargetDTO } from 'src/engine/core-modules/atlas-calls/dtos/atlas-call-target.dto';
import { AtlasCampaignDTO } from 'src/engine/core-modules/atlas-calls/dtos/atlas-campaign.dto';
import { AtlasScheduleCallsResultDTO } from 'src/engine/core-modules/atlas-calls/dtos/atlas-schedule-calls-result.dto';
import { AtlasScheduleCallsInput } from 'src/engine/core-modules/atlas-calls/dtos/atlas-schedule-calls.input';
import { AtlasTenantDTO } from 'src/engine/core-modules/atlas-calls/dtos/atlas-tenant.dto';
import { AtlasApiClientService } from 'src/engine/core-modules/atlas-calls/services/atlas-api-client.service';
import { AtlasCallTargetsService } from 'src/engine/core-modules/atlas-calls/services/atlas-call-targets.service';
import { type AuthContextUser } from 'src/engine/core-modules/auth/types/auth-context.type';
import { PreventNestToAutoLogGraphqlErrorsFilter } from 'src/engine/core-modules/graphql/filters/prevent-nest-to-auto-log-graphql-errors.filter';
import { ResolverValidationPipe } from 'src/engine/core-modules/graphql/pipes/resolver-validation.pipe';
import {
  ForbiddenError,
  UserInputError,
} from 'src/engine/core-modules/graphql/utils/graphql-errors.util';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { AuthUser } from 'src/engine/decorators/auth/auth-user.decorator';
import { AuthWorkspace } from 'src/engine/decorators/auth/auth-workspace.decorator';
import { UserAuthGuard } from 'src/engine/guards/user-auth.guard';
import { WorkspaceAuthGuard } from 'src/engine/guards/workspace-auth.guard';

@ArgsType()
class AtlasCallTargetsArgs {
  @Field(() => String)
  @IsString()
  objectNameSingular: string;

  @Field(() => [UUIDScalarType])
  @ArrayMaxSize(ATLAS_MAX_RECORDS_TO_RESOLVE)
  recordIds: string[];
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

@UseGuards(WorkspaceAuthGuard, UserAuthGuard)
@UsePipes(ResolverValidationPipe)
@UseFilters(PreventNestToAutoLogGraphqlErrorsFilter)
@CoreResolver()
export class AtlasCallsResolver {
  constructor(
    private readonly atlasApiClientService: AtlasApiClientService,
    private readonly atlasCallTargetsService: AtlasCallTargetsService,
  ) {}

  private assertWorkspaceAllowed(workspace: WorkspaceEntity) {
    if (!this.atlasApiClientService.isWorkspaceAllowed(workspace.id)) {
      throw new ForbiddenError(
        'Atlas calling is not enabled for this workspace',
      );
    }
  }

  // Vacío = el botón no tiene nada que ofrecer (workspace sin acceso o sin llaves).
  @Query(() => [AtlasTenantDTO])
  async atlasCallTenants(
    @AuthWorkspace() workspace: WorkspaceEntity,
  ): Promise<AtlasTenantDTO[]> {
    if (!this.atlasApiClientService.isWorkspaceAllowed(workspace.id)) {
      return [];
    }

    return this.atlasApiClientService.getConfiguredTenants();
  }

  @Query(() => [AtlasCampaignDTO])
  async atlasCallCampaigns(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @Args('tenantKey', { type: () => String }) tenantKey: string,
  ): Promise<AtlasCampaignDTO[]> {
    this.assertWorkspaceAllowed(workspace);

    return this.atlasApiClientService.listCampaigns(tenantKey);
  }

  @Query(() => [AtlasCallTargetDTO])
  async atlasCallTargets(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @Args() { objectNameSingular, recordIds }: AtlasCallTargetsArgs,
  ): Promise<AtlasCallTargetDTO[]> {
    this.assertWorkspaceAllowed(workspace);

    if (!this.atlasCallTargetsService.isSupportedObject(objectNameSingular)) {
      throw new UserInputError(
        `Atlas calls are only available for people, opportunities and companies`,
      );
    }

    return this.atlasCallTargetsService.resolveTargets({
      workspaceId: workspace.id,
      objectNameSingular,
      recordIds: [...new Set(recordIds)],
    });
  }

  @Mutation(() => AtlasScheduleCallsResultDTO)
  async atlasScheduleCalls(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @AuthUser() user: AuthContextUser,
    @Args('input') input: AtlasScheduleCallsInput,
  ): Promise<AtlasScheduleCallsResultDTO> {
    this.assertWorkspaceAllowed(workspace);

    const tenantLabel = this.atlasApiClientService.getTenantLabel(
      input.tenantKey,
    );

    if (!isDefined(tenantLabel)) {
      throw new UserInputError(`Unknown Atlas tenant "${input.tenantKey}"`);
    }

    // La campaña debe existir en ese tenant: evita mandar llamadas a un ID ajeno o borrado.
    const campaigns = await this.atlasApiClientService.listCampaigns(
      input.tenantKey,
    );
    const campaign = campaigns.find((entry) => entry.id === input.campaignId);

    if (!isDefined(campaign)) {
      throw new UserInputError(
        `Campaign ${input.campaignId} was not found in ${tenantLabel}`,
      );
    }

    if (isNonEmptyString(input.scheduledAt)) {
      const scheduledTime = new Date(input.scheduledAt).getTime();

      if (Number.isNaN(scheduledTime)) {
        throw new UserInputError('Invalid scheduled date');
      }

      if (scheduledTime < Date.now() - 60_000) {
        throw new UserInputError('The scheduled date is in the past');
      }
    }

    const results: AtlasScheduleCallsResultDTO['results'] = [];
    const requestedBy = user.email ?? 'PTS AI CRM';

    for (const [index, target] of input.targets.entries()) {
      if (index > 0) {
        await sleep(ATLAS_SCHEDULE_SPACING_MS);
      }

      const outcome = await this.atlasApiClientService.scheduleCall({
        tenantKey: input.tenantKey,
        campaignId: input.campaignId,
        phone: target.phone,
        firstName: target.firstName,
        lastName: target.lastName,
        info: [target.info, `Sent from PTS AI CRM by ${requestedBy}`]
          .filter(isNonEmptyString)
          .join(' · '),
        scheduledAt: input.scheduledAt,
      });

      results.push({
        recordId: target.recordId,
        phone: target.phone,
        ok: outcome.ok,
        sequenceNumber: outcome.sequenceNumber,
        error: outcome.error,
      });
    }

    return {
      scheduledCount: results.filter((result) => result.ok).length,
      failedCount: results.filter((result) => !result.ok).length,
      campaignName: campaign.name,
      tenantLabel,
      results,
    };
  }
}
