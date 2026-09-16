import {
  type Nullable,
  type RecordGqlOperationFilter,
} from 'twenty-shared/types';
import {
  isDefined,
  turnAnyFieldFilterIntoRecordGqlFilter,
} from 'twenty-shared/utils';

import { flattenedFieldMetadataItemsSelector } from '@/object-metadata/states/flattenedFieldMetadataItemsSelector';
import { type EnrichedObjectMetadataItem } from '@/object-metadata/types/EnrichedObjectMetadataItem';
import { turnAnyFieldSearchIntoRecordGqlFilter } from '@/object-record/record-filter/utils/buildRelationLabelSearchGqlFilters';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';

// Filtro de la barra de búsqueda: campos propios (comportamiento nativo) + el
// nombre de los registros relacionados many-to-one (empresa del deal, etc.).
export const useAnyFieldSearchGqlFilter = ({
  objectMetadataItem,
  anyFieldFilterValue,
}: {
  objectMetadataItem: Nullable<EnrichedObjectMetadataItem>;
  anyFieldFilterValue: string;
}): RecordGqlOperationFilter => {
  const fieldMetadataItems = useAtomStateValue(
    flattenedFieldMetadataItemsSelector,
  );

  const { recordGqlOperationFilter: anyFieldFilter } =
    turnAnyFieldFilterIntoRecordGqlFilter({
      fields: objectMetadataItem?.fields ?? [],
      filterValue: anyFieldFilterValue,
    });

  if (!isDefined(objectMetadataItem)) {
    return anyFieldFilter;
  }

  return turnAnyFieldSearchIntoRecordGqlFilter({
    objectMetadataItem,
    fieldMetadataItems,
    filterValue: anyFieldFilterValue,
    anyFieldFilter,
  });
};
