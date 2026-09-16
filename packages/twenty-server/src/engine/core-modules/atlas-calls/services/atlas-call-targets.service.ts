import { Injectable } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';
import { isDefined } from 'twenty-shared/utils';
import { In } from 'typeorm';

import { type AtlasCallTargetDTO } from 'src/engine/core-modules/atlas-calls/dtos/atlas-call-target.dto';
import { normalizePhoneNumber } from 'src/engine/core-modules/atlas-calls/utils/normalize-phone-number.util';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';
import { type CompanyWorkspaceEntity } from 'src/modules/company/standard-objects/company.workspace-entity';
import { type OpportunityWorkspaceEntity } from 'src/modules/opportunity/standard-objects/opportunity.workspace-entity';
import { type PersonWorkspaceEntity } from 'src/modules/person/standard-objects/person.workspace-entity';

export const ATLAS_SUPPORTED_OBJECTS = ['person', 'opportunity', 'company'];

// Lectura de sistema: el usuario ya pasó los guards del resolver y solo leemos
// nombre/teléfono/empresa, igual que la tabla que tiene delante.
const SYSTEM_READ = { shouldBypassPermissionChecks: true } as const;

type PersonLike = Pick<
  PersonWorkspaceEntity,
  'id' | 'name' | 'phones' | 'companyId' | 'createdAt'
> & { company?: Pick<CompanyWorkspaceEntity, 'id' | 'name'> | null };

const getPersonPhone = (person: PersonLike): string | null => {
  const primary = normalizePhoneNumber(
    person.phones?.primaryPhoneNumber,
    person.phones?.primaryPhoneCallingCode,
  );

  if (isDefined(primary)) {
    return primary;
  }

  for (const additional of person.phones?.additionalPhones ?? []) {
    const normalized = normalizePhoneNumber(
      additional?.number,
      additional?.callingCode,
    );

    if (isDefined(normalized)) {
      return normalized;
    }
  }

  return null;
};

const getPersonFirstName = (person: PersonLike): string =>
  (person.name?.firstName ?? '').trim();

const getPersonLastName = (person: PersonLike): string | null => {
  const lastName = (person.name?.lastName ?? '').trim();

  return lastName.length > 0 ? lastName : null;
};

const getPersonLabel = (person: PersonLike): string =>
  [getPersonFirstName(person), getPersonLastName(person) ?? '']
    .join(' ')
    .trim() || 'Unnamed person';

// El ORM devuelve Date en createdAt aunque el tipo diga string.
const byCreatedAt = (
  a: { createdAt: string | Date },
  b: { createdAt: string | Date },
) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();

@Injectable()
export class AtlasCallTargetsService {
  constructor(
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
  ) {}

  async resolveTargets({
    workspaceId,
    objectNameSingular,
    recordIds,
  }: {
    workspaceId: string;
    objectNameSingular: string;
    recordIds: string[];
  }): Promise<AtlasCallTargetDTO[]> {
    if (recordIds.length === 0) {
      return [];
    }

    const authContext = buildSystemAuthContext(workspaceId);

    return this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        switch (objectNameSingular) {
          case 'person':
            return this.resolveFromPeople(workspaceId, recordIds);
          case 'opportunity':
            return this.resolveFromOpportunities(workspaceId, recordIds);
          case 'company':
            return this.resolveFromCompanies(workspaceId, recordIds);
          default:
            throw new Error(
              `Object "${objectNameSingular}" is not supported for Atlas calls`,
            );
        }
      },
      authContext,
    );
  }

  private async resolveFromPeople(
    workspaceId: string,
    personIds: string[],
  ): Promise<AtlasCallTargetDTO[]> {
    const personRepository =
      await this.globalWorkspaceOrmManager.getRepository<PersonWorkspaceEntity>(
        workspaceId,
        'person',
        SYSTEM_READ,
      );

    const people = (await personRepository.find({
      where: { id: In(personIds) },
      relations: ['company'],
    })) as unknown as PersonLike[];

    const peopleById = new Map(people.map((person) => [person.id, person]));

    return personIds
      .map((personId) => peopleById.get(personId))
      .filter(isDefined)
      .map((person) => {
        const phone = getPersonPhone(person);

        return {
          recordId: person.id,
          objectNameSingular: 'person',
          recordLabel: getPersonLabel(person),
          personId: person.id,
          firstName: getPersonFirstName(person) || getPersonLabel(person),
          lastName: getPersonLastName(person),
          companyName: person.company?.name ?? null,
          phone,
          phoneSource: isDefined(phone) ? 'person.phones' : null,
          reason: isDefined(phone) ? null : 'No phone number on this person',
        };
      });
  }

  private async resolveFromOpportunities(
    workspaceId: string,
    opportunityIds: string[],
  ): Promise<AtlasCallTargetDTO[]> {
    const opportunityRepository =
      await this.globalWorkspaceOrmManager.getRepository<OpportunityWorkspaceEntity>(
        workspaceId,
        'opportunity',
        SYSTEM_READ,
      );
    const personRepository =
      await this.globalWorkspaceOrmManager.getRepository<PersonWorkspaceEntity>(
        workspaceId,
        'person',
        SYSTEM_READ,
      );

    const opportunities = (await opportunityRepository.find({
      where: { id: In(opportunityIds) },
      relations: ['pointOfContact', 'company'],
    })) as unknown as (OpportunityWorkspaceEntity &
      Record<string, unknown> & {
        pointOfContact: PersonLike | null;
        company: Pick<CompanyWorkspaceEntity, 'id' | 'name'> | null;
      })[];

    const companyIdsNeedingPeople = opportunities
      .filter(
        (opportunity) =>
          isDefined(opportunity.companyId) &&
          (!isDefined(opportunity.pointOfContact) ||
            !isDefined(getPersonPhone(opportunity.pointOfContact))),
      )
      .map((opportunity) => opportunity.companyId as string);

    const companyPeople =
      companyIdsNeedingPeople.length > 0
        ? ((await personRepository.find({
            where: { companyId: In([...new Set(companyIdsNeedingPeople)]) },
          })) as unknown as PersonLike[])
        : [];

    const peopleByCompanyId = new Map<string, PersonLike[]>();

    for (const person of companyPeople.sort(byCreatedAt)) {
      if (!isDefined(person.companyId)) {
        continue;
      }

      const list = peopleByCompanyId.get(person.companyId) ?? [];

      list.push(person);
      peopleByCompanyId.set(person.companyId, list);
    }

    const opportunitiesById = new Map(
      opportunities.map((opportunity) => [opportunity.id, opportunity]),
    );

    return opportunityIds
      .map((opportunityId) => opportunitiesById.get(opportunityId))
      .filter(isDefined)
      .map((opportunity) => {
        const label =
          (opportunity.name ?? '').trim() ||
          opportunity.company?.name ||
          'Unnamed opportunity';
        const companyName = opportunity.company?.name ?? null;

        const base = {
          recordId: opportunity.id,
          objectNameSingular: 'opportunity',
          recordLabel: label,
          companyName,
        };

        const pointOfContact = opportunity.pointOfContact;
        const pointOfContactPhone = isDefined(pointOfContact)
          ? getPersonPhone(pointOfContact)
          : null;

        if (isDefined(pointOfContact) && isDefined(pointOfContactPhone)) {
          return {
            ...base,
            personId: pointOfContact.id,
            firstName:
              getPersonFirstName(pointOfContact) ||
              getPersonLabel(pointOfContact),
            lastName: getPersonLastName(pointOfContact),
            phone: pointOfContactPhone,
            phoneSource: 'opportunity.pointOfContact',
            reason: null,
          };
        }

        // Campo custom del workspace PTS AI (enriquecimiento 2026-09-03). Puede no existir.
        const bestPhone = normalizePhoneNumber(
          typeof opportunity.bestPhone === 'string'
            ? opportunity.bestPhone
            : null,
        );

        if (isDefined(bestPhone)) {
          return {
            ...base,
            personId: pointOfContact?.id ?? null,
            firstName: isDefined(pointOfContact)
              ? getPersonFirstName(pointOfContact) ||
                getPersonLabel(pointOfContact)
              : (companyName ?? label),
            lastName: isDefined(pointOfContact)
              ? getPersonLastName(pointOfContact)
              : null,
            phone: bestPhone,
            phoneSource: 'opportunity.bestPhone',
            reason: null,
          };
        }

        const companyContact = isDefined(opportunity.companyId)
          ? (peopleByCompanyId.get(opportunity.companyId) ?? []).find(
              (person) => isDefined(getPersonPhone(person)),
            )
          : undefined;

        if (isDefined(companyContact)) {
          return {
            ...base,
            personId: companyContact.id,
            firstName:
              getPersonFirstName(companyContact) ||
              getPersonLabel(companyContact),
            lastName: getPersonLastName(companyContact),
            phone: getPersonPhone(companyContact),
            phoneSource: 'company.person',
            reason: null,
          };
        }

        return {
          ...base,
          personId: pointOfContact?.id ?? null,
          firstName: isDefined(pointOfContact)
            ? getPersonLabel(pointOfContact)
            : (companyName ?? label),
          lastName: null,
          phone: null,
          phoneSource: null,
          reason: isDefined(pointOfContact)
            ? 'Point of contact has no phone number'
            : isDefined(opportunity.companyId)
              ? 'No point of contact and nobody at the company has a phone'
              : 'No point of contact or company on this opportunity',
        };
      });
  }

  private async resolveFromCompanies(
    workspaceId: string,
    companyIds: string[],
  ): Promise<AtlasCallTargetDTO[]> {
    const companyRepository =
      await this.globalWorkspaceOrmManager.getRepository<CompanyWorkspaceEntity>(
        workspaceId,
        'company',
        SYSTEM_READ,
      );
    const personRepository =
      await this.globalWorkspaceOrmManager.getRepository<PersonWorkspaceEntity>(
        workspaceId,
        'person',
        SYSTEM_READ,
      );

    const companies = (await companyRepository.find({
      where: { id: In(companyIds) },
    })) as unknown as Pick<CompanyWorkspaceEntity, 'id' | 'name'>[];

    const people = (await personRepository.find({
      where: { companyId: In(companyIds) },
    })) as unknown as PersonLike[];

    const peopleByCompanyId = new Map<string, PersonLike[]>();

    for (const person of people.sort(byCreatedAt)) {
      if (!isDefined(person.companyId)) {
        continue;
      }

      const list = peopleByCompanyId.get(person.companyId) ?? [];

      list.push(person);
      peopleByCompanyId.set(person.companyId, list);
    }

    const companiesById = new Map(
      companies.map((company) => [company.id, company]),
    );

    return companyIds
      .map((companyId) => companiesById.get(companyId))
      .filter(isDefined)
      .flatMap((company): AtlasCallTargetDTO[] => {
        const companyName = (company.name ?? '').trim() || 'Unnamed company';
        const contacts = (peopleByCompanyId.get(company.id) ?? []).filter(
          (person) => isDefined(getPersonPhone(person)),
        );

        if (contacts.length === 0) {
          return [
            {
              recordId: company.id,
              objectNameSingular: 'company',
              recordLabel: companyName,
              personId: null,
              firstName: companyName,
              lastName: null,
              companyName,
              phone: null,
              phoneSource: null,
              reason: 'Nobody at this company has a phone number',
            },
          ];
        }

        // Una fila por persona con teléfono; el usuario desmarca a quien no quiera llamar.
        return contacts.map((person) => ({
          recordId: company.id,
          objectNameSingular: 'company',
          recordLabel: companyName,
          personId: person.id,
          firstName: getPersonFirstName(person) || getPersonLabel(person),
          lastName: getPersonLastName(person),
          companyName,
          phone: getPersonPhone(person),
          phoneSource: 'company.person',
          reason: null,
        }));
      });
  }

  isSupportedObject(objectNameSingular: string): boolean {
    return ATLAS_SUPPORTED_OBJECTS.includes(objectNameSingular);
  }

  static describeTarget(target: AtlasCallTargetDTO): string {
    return [
      target.recordLabel,
      isNonEmptyString(target.companyName) ? `(${target.companyName})` : '',
    ]
      .join(' ')
      .trim();
  }
}
