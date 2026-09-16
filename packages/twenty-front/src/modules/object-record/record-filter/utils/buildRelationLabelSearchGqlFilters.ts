import { isNonEmptyString } from '@sniptt/guards';
import {
  FieldMetadataType,
  RelationType,
  type RecordGqlOperationFilter,
} from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';

import { type EnrichedObjectMetadataItem } from '@/object-metadata/types/EnrichedObjectMetadataItem';
import { type FieldMetadataItem } from '@/object-metadata/types/FieldMetadataItem';

// Objetos destino que no tiene sentido (o no es seguro) buscar por nombre desde otra vista.
const EXCLUDED_TARGET_OBJECTS = new Set([
  'workspaceMember',
  'workflow',
  'workflowVersion',
  'workflowRun',
  'dashboard',
  'messageThread',
  'calendarEvent',
  'timelineActivity',
  'attachment',
  'favorite',
  'note',
  'task',
]);

// La búsqueda "any field" nativa solo mira los campos propios del objeto. Aquí
// añadimos, para cada relación many-to-one (p.ej. Opportunity.company), un filtro
// sobre el campo `name` del objeto destino (Company.name, Person.name…), de modo
// que buscar "Acme" en el pipeline encuentre los deals de Acme. Trabaja con la
// lista aplanada de campos de TODOS los objetos (traen `objectMetadataId`), así
// sirve tanto en hooks como en utilidades puras (context store / select all).
export const buildRelationLabelSearchGqlFilters = ({
  objectMetadataItem,
  fieldMetadataItems,
  filterValue,
}: {
  objectMetadataItem: Pick<EnrichedObjectMetadataItem, 'fields'>;
  fieldMetadataItems: FieldMetadataItem[];
  filterValue: string;
}): RecordGqlOperationFilter[] => {
  if (!isNonEmptyString(filterValue.trim())) {
    return [];
  }

  const likeValue = `%${filterValue.trim()}%`;
  const filters: RecordGqlOperationFilter[] = [];

  for (const field of objectMetadataItem.fields) {
    if (
      field.type !== FieldMetadataType.RELATION ||
      !field.isActive ||
      field.relation?.type !== RelationType.MANY_TO_ONE
    ) {
      continue;
    }

    const targetObjectMetadata = field.relation.targetObjectMetadata;

    if (
      !isDefined(targetObjectMetadata) ||
      EXCLUDED_TARGET_OBJECTS.has(targetObjectMetadata.nameSingular)
    ) {
      continue;
    }

    const labelField = fieldMetadataItems.find(
      (candidate) =>
        candidate.objectMetadataId === targetObjectMetadata.id &&
        candidate.name === 'name' &&
        candidate.isActive &&
        (candidate.type === FieldMetadataType.TEXT ||
          candidate.type === FieldMetadataType.FULL_NAME),
    );

    if (!isDefined(labelField)) {
      continue;
    }

    if (labelField.type === FieldMetadataType.TEXT) {
      filters.push({
        [field.name]: { [labelField.name]: { ilike: likeValue } },
      });
    } else {
      filters.push({
        [field.name]: {
          or: [
            { [labelField.name]: { firstName: { ilike: likeValue } } },
            { [labelField.name]: { lastName: { ilike: likeValue } } },
          ],
        },
      });
    }
  }

  return filters;
};

// Versión "any field + nombre de relaciones" del filtro nativo. Devuelve `{}` sin texto.
export const turnAnyFieldSearchIntoRecordGqlFilter = ({
  objectMetadataItem,
  fieldMetadataItems,
  filterValue,
  anyFieldFilter,
}: {
  objectMetadataItem: Pick<EnrichedObjectMetadataItem, 'fields'>;
  fieldMetadataItems: FieldMetadataItem[];
  filterValue: string;
  anyFieldFilter: RecordGqlOperationFilter;
}): RecordGqlOperationFilter => {
  const relationLabelFilters = buildRelationLabelSearchGqlFilters({
    objectMetadataItem,
    fieldMetadataItems,
    filterValue,
  });

  if (relationLabelFilters.length === 0) {
    return anyFieldFilter;
  }

  const existingOrFilters: RecordGqlOperationFilter[] =
    'or' in anyFieldFilter && Array.isArray(anyFieldFilter.or)
      ? (anyFieldFilter.or as RecordGqlOperationFilter[])
      : [];

  return { or: [...existingOrFilters, ...relationLabelFilters] };
};
