import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType('AtlasTenant')
export class AtlasTenantDTO {
  @Field(() => String)
  key: string;

  @Field(() => String)
  label: string;
}
