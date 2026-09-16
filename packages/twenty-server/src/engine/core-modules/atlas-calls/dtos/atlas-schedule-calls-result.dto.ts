import { Field, Int, ObjectType } from '@nestjs/graphql';

import { UUIDScalarType } from 'src/engine/api/graphql/workspace-schema-builder/graphql-types/scalars';

@ObjectType('AtlasScheduleCallResult')
export class AtlasScheduleCallResultDTO {
  @Field(() => UUIDScalarType)
  recordId: string;

  @Field(() => String)
  phone: string;

  @Field(() => Boolean)
  ok: boolean;

  @Field(() => Int, { nullable: true })
  sequenceNumber: number | null;

  @Field(() => String, { nullable: true })
  error: string | null;
}

@ObjectType('AtlasScheduleCallsResult')
export class AtlasScheduleCallsResultDTO {
  @Field(() => Int)
  scheduledCount: number;

  @Field(() => Int)
  failedCount: number;

  @Field(() => String)
  campaignName: string;

  @Field(() => String)
  tenantLabel: string;

  @Field(() => [AtlasScheduleCallResultDTO])
  results: AtlasScheduleCallResultDTO[];
}
