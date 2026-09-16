import { Field, ObjectType } from '@nestjs/graphql';

import { UUIDScalarType } from 'src/engine/api/graphql/workspace-schema-builder/graphql-types/scalars';

@ObjectType('AtlasCallTarget')
export class AtlasCallTargetDTO {
  // Registro seleccionado en el CRM (person, opportunity o company).
  @Field(() => UUIDScalarType)
  recordId: string;

  @Field(() => String)
  objectNameSingular: string;

  @Field(() => String)
  recordLabel: string;

  // Persona a la que se llama (puede no existir si el teléfono vino de un campo del deal).
  @Field(() => UUIDScalarType, { nullable: true })
  personId: string | null;

  @Field(() => String)
  firstName: string;

  @Field(() => String, { nullable: true })
  lastName: string | null;

  @Field(() => String, { nullable: true })
  companyName: string | null;

  @Field(() => String, { nullable: true })
  phone: string | null;

  // De dónde salió el teléfono: person.phones · opportunity.bestPhone · company.person
  @Field(() => String, { nullable: true })
  phoneSource: string | null;

  @Field(() => String, { nullable: true })
  reason: string | null;
}
