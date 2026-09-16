import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType('AtlasCampaign')
export class AtlasCampaignDTO {
  @Field(() => String)
  id: string;

  @Field(() => String)
  name: string;

  @Field(() => String, { nullable: true })
  status: string | null;

  @Field(() => String, { nullable: true })
  callType: string | null;

  @Field(() => String, { nullable: true })
  timeWindows: string | null;

  @Field(() => String, { nullable: true })
  timezone: string | null;
}
