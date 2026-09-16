import { Field, InputType } from '@nestjs/graphql';

import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';

import { UUIDScalarType } from 'src/engine/api/graphql/workspace-schema-builder/graphql-types/scalars';
import { ATLAS_MAX_TARGETS_PER_REQUEST } from 'src/engine/core-modules/atlas-calls/constants/atlas-calls.constants';

@InputType()
export class AtlasScheduleCallTargetInput {
  @Field(() => UUIDScalarType)
  @IsUUID()
  recordId: string;

  @Field(() => String)
  @IsString()
  @MaxLength(40)
  phone: string;

  @Field(() => String)
  @IsString()
  @MaxLength(120)
  firstName: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  lastName?: string | null;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  info?: string | null;
}

@InputType()
export class AtlasScheduleCallsInput {
  @Field(() => String)
  @IsString()
  tenantKey: string;

  @Field(() => String)
  @IsString()
  @MaxLength(100)
  campaignId: string;

  // ISO-8601 en UTC. Si viene vacío, la llamada sale de inmediato.
  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsISO8601()
  scheduledAt?: string | null;

  @Field(() => [AtlasScheduleCallTargetInput])
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(ATLAS_MAX_TARGETS_PER_REQUEST)
  @ValidateNested({ each: true })
  @Type(() => AtlasScheduleCallTargetInput)
  targets: AtlasScheduleCallTargetInput[];
}
