import { useCallback } from 'react';
import { CoreObjectNameSingular } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';
import { v4 } from 'uuid';

import { buildAtlasCallNoteBody } from '@/atlas-calls/utils/buildAtlasCallNoteBody';
import {
  type AtlasCallTarget,
  type AtlasScheduleCallsResult,
} from '@/atlas-calls/types/AtlasCallTypes';
import { useCreateManyRecords } from '@/object-record/hooks/useCreateManyRecords';

const TARGET_FIELD_BY_OBJECT: Record<string, string> = {
  person: 'targetPersonId',
  opportunity: 'targetOpportunityId',
  company: 'targetCompanyId',
};

// Deja una nota en cada registro llamado ("Atlas call scheduled") para que el
// historial quede en el CRM y no solo en Atlas.
export const useAtlasCallNotes = () => {
  const { createManyRecords: createManyNotes } = useCreateManyRecords({
    objectNameSingular: CoreObjectNameSingular.Note,
    shouldMatchRootQueryFilter: false,
  });

  const { createManyRecords: createManyNoteTargets } = useCreateManyRecords({
    objectNameSingular: CoreObjectNameSingular.NoteTarget,
    shouldMatchRootQueryFilter: false,
  });

  const createAtlasCallNotes = useCallback(
    async ({
      targets,
      result,
      scheduledLabel,
    }: {
      targets: AtlasCallTarget[];
      result: AtlasScheduleCallsResult;
      scheduledLabel: string;
    }) => {
      const successfulResults = result.results.filter((entry) => entry.ok);

      if (successfulResults.length === 0) {
        return;
      }

      const notesToCreate: Record<string, unknown>[] = [];
      const noteTargetsToCreate: Record<string, unknown>[] = [];

      for (const entry of successfulResults) {
        const target = targets.find(
          (candidate) =>
            candidate.recordId === entry.recordId &&
            candidate.phone === entry.phone,
        );

        if (!isDefined(target)) {
          continue;
        }

        const noteId = v4();
        const calleeName = [target.firstName, target.lastName ?? '']
          .join(' ')
          .trim();

        notesToCreate.push({
          id: noteId,
          title: `Atlas call scheduled · ${result.campaignName}`,
          bodyV2: buildAtlasCallNoteBody([
            `Sent to Atlas (${result.tenantLabel}) · campaign "${result.campaignName}".`,
            `Calling ${calleeName} at ${target.phone} · ${scheduledLabel}.`,
            isDefined(entry.sequenceNumber)
              ? `Atlas sequence number: ${entry.sequenceNumber}.`
              : 'Queued in Atlas.',
          ]),
        });

        const targetField = TARGET_FIELD_BY_OBJECT[target.objectNameSingular];

        if (isDefined(targetField)) {
          noteTargetsToCreate.push({
            id: v4(),
            noteId,
            [targetField]: target.recordId,
          });
        }

        // Si la persona llamada no es el registro seleccionado (deal / empresa), también la enlazamos.
        if (
          isDefined(target.personId) &&
          target.objectNameSingular !== 'person'
        ) {
          noteTargetsToCreate.push({
            id: v4(),
            noteId,
            targetPersonId: target.personId,
          });
        }
      }

      if (notesToCreate.length === 0) {
        return;
      }

      await createManyNotes({ recordsToCreate: notesToCreate });
      await createManyNoteTargets({ recordsToCreate: noteTargetsToCreate });
    },
    [createManyNotes, createManyNoteTargets],
  );

  return { createAtlasCallNotes };
};
