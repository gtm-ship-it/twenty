import { useCallback } from 'react';

import { useContextStoreObjectMetadataItemOrThrow } from '@/context-store/hooks/useContextStoreObjectMetadataItemOrThrow';
import { contextStoreAnyFieldFilterValueComponentState } from '@/context-store/states/contextStoreAnyFieldFilterValueComponentState';
import { contextStoreFilterGroupsComponentState } from '@/context-store/states/contextStoreFilterGroupsComponentState';
import { contextStoreFiltersComponentState } from '@/context-store/states/contextStoreFiltersComponentState';
import { contextStoreTargetedRecordsRuleComponentState } from '@/context-store/states/contextStoreTargetedRecordsRuleComponentState';
import { computeContextStoreFilters } from '@/context-store/utils/computeContextStoreFilters';
import { flattenedFieldMetadataItemsSelector } from '@/object-metadata/states/flattenedFieldMetadataItemsSelector';
import { useLazyFetchAllRecords } from '@/object-record/hooks/useLazyFetchAllRecords';
import { useFilterValueDependencies } from '@/object-record/record-filter/hooks/useFilterValueDependencies';
import { useAtomComponentStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomComponentStateValue';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';

export const ATLAS_MAX_TARGET_RECORDS = 500;

// Resuelve los IDs de los registros apuntados por la selección del contexto:
// selección explícita, o "seleccionar todo" con los filtros de la vista.
export const useAtlasTargetRecordIds = ({
  contextStoreInstanceId,
}: {
  contextStoreInstanceId: string;
}) => {
  const { objectMetadataItem } = useContextStoreObjectMetadataItemOrThrow(
    contextStoreInstanceId,
  );

  const contextStoreTargetedRecordsRule = useAtomComponentStateValue(
    contextStoreTargetedRecordsRuleComponentState,
    contextStoreInstanceId,
  );

  const contextStoreFilters = useAtomComponentStateValue(
    contextStoreFiltersComponentState,
    contextStoreInstanceId,
  );

  const contextStoreFilterGroups = useAtomComponentStateValue(
    contextStoreFilterGroupsComponentState,
    contextStoreInstanceId,
  );

  const contextStoreAnyFieldFilterValue = useAtomComponentStateValue(
    contextStoreAnyFieldFilterValueComponentState,
    contextStoreInstanceId,
  );

  const { filterValueDependencies } = useFilterValueDependencies();

  const flattenedFieldMetadataItems = useAtomStateValue(
    flattenedFieldMetadataItemsSelector,
  );

  const graphqlFilter = computeContextStoreFilters({
    contextStoreTargetedRecordsRule,
    contextStoreFilters,
    contextStoreFilterGroups,
    objectMetadataItem,
    fieldMetadataItems: flattenedFieldMetadataItems,
    filterValueDependencies,
    contextStoreAnyFieldFilterValue,
  });

  const { fetchAllRecords, isDownloading } = useLazyFetchAllRecords({
    objectNameSingular: objectMetadataItem.nameSingular,
    filter: graphqlFilter,
    limit: 100,
    maximumRequests: ATLAS_MAX_TARGET_RECORDS / 100,
    recordGqlFields: { id: true },
  });

  const fetchTargetRecordIds = useCallback(async () => {
    if (contextStoreTargetedRecordsRule.mode === 'selection') {
      return {
        recordIds: contextStoreTargetedRecordsRule.selectedRecordIds.slice(
          0,
          ATLAS_MAX_TARGET_RECORDS,
        ),
        isTruncated:
          contextStoreTargetedRecordsRule.selectedRecordIds.length >
          ATLAS_MAX_TARGET_RECORDS,
      };
    }

    const records = await fetchAllRecords();
    const recordIds = records.map((record) => record.id);

    return {
      recordIds: recordIds.slice(0, ATLAS_MAX_TARGET_RECORDS),
      isTruncated: recordIds.length >= ATLAS_MAX_TARGET_RECORDS,
    };
  }, [contextStoreTargetedRecordsRule, fetchAllRecords]);

  return {
    objectMetadataItem,
    fetchTargetRecordIds,
    isFetchingRecordIds: isDownloading,
  };
};
