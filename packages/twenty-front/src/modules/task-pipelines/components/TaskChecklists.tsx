import { styled } from '@linaria/react';
import { t } from '@lingui/core/macro';
import { useRef, useState } from 'react';
import { IconPhoto, IconPlus, IconTrash } from 'twenty-ui/icon';
import { Button } from 'twenty-ui/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { v4 } from 'uuid';

import {
  MemberAvatar,
  StyledFieldLabel,
  StyledHint,
  StyledTextInput,
} from '@/task-pipelines/components/TaskPipelineUi';
import { type TaskMemberInfo } from '@/task-pipelines/hooks/useWorkspaceMembersById';
import {
  type TaskAttachment,
  type TaskChecklist,
  type TaskChecklistPoint,
} from '@/task-pipelines/types/TaskPipelineTypes';
import {
  dueFromInputValue,
  dueInputValue,
  formatTaskDueDate,
  getTaskDueStatus,
} from '@/task-pipelines/utils/taskDueStatus';

const StyledChecklist = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[1]};
`;

const StyledChecklistHeader = styled.div`
  align-items: center;
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledTitleInput = styled.input`
  background: transparent;
  border: 1px solid transparent;
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.primary};
  flex: 1;
  font-family: inherit;
  font-size: ${themeCssVariables.font.size.md};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  min-width: 0;
  outline: none;
  padding: 2px 4px;

  &:hover,
  &:focus {
    border-color: ${themeCssVariables.border.color.medium};
  }
`;

const StyledCount = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
`;

const StyledProgress = styled.div`
  background: ${themeCssVariables.background.tertiary};
  border-radius: 4px;
  height: 6px;
  overflow: hidden;
`;

const StyledProgressFill = styled.div<{ percent: number }>`
  background: ${themeCssVariables.color.green};
  height: 100%;
  transition: width 0.2s ease;
  width: ${({ percent }) => `${percent}%`};
`;

const StyledPoint = styled.div`
  border-radius: ${themeCssVariables.border.radius.sm};
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 4px;

  &:hover {
    background: ${themeCssVariables.background.transparent.lighter};
  }

  &:hover .point-action {
    opacity: 1;
  }
`;

const StyledPointRow = styled.div`
  align-items: center;
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledPointText = styled.input<{ isDone: boolean }>`
  background: transparent;
  border: none;
  color: ${({ isDone }) =>
    isDone
      ? themeCssVariables.font.color.tertiary
      : themeCssVariables.font.color.primary};
  flex: 1;
  font-family: inherit;
  font-size: ${themeCssVariables.font.size.md};
  min-width: 0;
  outline: none;
  text-decoration: ${({ isDone }) => (isDone ? 'line-through' : 'none')};
`;

const StyledPointMeta = styled.div`
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: ${themeCssVariables.spacing[2]};
  padding-left: 24px;
`;

const StyledMiniSelect = styled.select`
  background: transparent;
  border: 1px solid ${themeCssVariables.border.color.light};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.secondary};
  font-family: inherit;
  font-size: ${themeCssVariables.font.size.xs};
  max-width: 160px;
  padding: 1px 4px;
`;

const StyledMiniDate = styled.input<{ tone: 'danger' | 'warning' | 'default' }>`
  background: transparent;
  border: 1px solid ${themeCssVariables.border.color.light};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${({ tone }) =>
    tone === 'danger'
      ? themeCssVariables.color.red
      : tone === 'warning'
        ? themeCssVariables.color.orange
        : themeCssVariables.font.color.secondary};
  font-family: inherit;
  font-size: ${themeCssVariables.font.size.xs};
  padding: 0 4px;
`;

const StyledIconAction = styled.button`
  align-items: center;
  background: transparent;
  border: none;
  color: ${themeCssVariables.font.color.tertiary};
  cursor: pointer;
  display: inline-flex;
  font-family: inherit;
  font-size: ${themeCssVariables.font.size.xs};
  gap: 2px;
  opacity: 0.6;
  padding: 0 2px;

  &:hover,
  &:focus-visible {
    color: ${themeCssVariables.font.color.primary};
    opacity: 1;
  }
`;

const StyledPhotos = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding-left: 24px;
`;

const StyledPhoto = styled.div`
  position: relative;

  img {
    border: 1px solid ${themeCssVariables.border.color.light};
    border-radius: ${themeCssVariables.border.radius.sm};
    display: block;
    height: 64px;
    object-fit: cover;
    width: 88px;
  }

  button {
    background: ${themeCssVariables.background.primary};
    border: 1px solid ${themeCssVariables.border.color.medium};
    border-radius: 50%;
    cursor: pointer;
    font-size: 10px;
    height: 18px;
    line-height: 1;
    opacity: 0;
    padding: 0;
    position: absolute;
    right: -6px;
    top: -6px;
    width: 18px;
  }

  &:hover button,
  button:focus-visible {
    opacity: 1;
  }
`;

type TaskChecklistsProps = {
  checklists: TaskChecklist[];
  members: TaskMemberInfo[];
  membersById: Map<string, TaskMemberInfo>;
  attachments: TaskAttachment[];
  onChange: (next: TaskChecklist[]) => void;
  onUploadPhoto: (checklistItemId: string, file: File) => Promise<void>;
  onDeletePhoto: (attachmentId: string) => Promise<void>;
};

const newPoint = (text: string): TaskChecklistPoint => ({
  id: v4(),
  text,
  done: false,
  assigneeWorkspaceMemberId: null,
  dueAt: null,
  completedAt: null,
});

// Varias checklists por tarjeta (como Trello); cada punto con su responsable,
// fecha y fotos del paso a paso. Los cambios se aplican en local al instante y
// el panel los guarda en cola.
export const TaskChecklists = ({
  checklists,
  members,
  membersById,
  attachments,
  onChange,
  onUploadPhoto,
  onDeletePhoto,
}: TaskChecklistsProps) => {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [newItems, setNewItems] = useState<Record<string, string>>({});
  const [uploadingItemId, setUploadingItemId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // oxlint-disable-next-line twenty/no-state-useref
  const pendingItemId = useRef<string | null>(null);

  const photosByItem = new Map<string, TaskAttachment[]>();

  for (const attachment of attachments) {
    if (attachment.checklistItemId !== null) {
      photosByItem.set(attachment.checklistItemId, [
        ...(photosByItem.get(attachment.checklistItemId) ?? []),
        attachment,
      ]);
    }
  }

  const updateChecklist = (
    checklistId: string,
    update: (checklist: TaskChecklist) => TaskChecklist | null,
  ) =>
    onChange(
      checklists.flatMap((checklist) => {
        if (checklist.id !== checklistId) {
          return [checklist];
        }

        const next = update(checklist);

        return next === null ? [] : [next];
      }),
    );

  const updatePoint = (
    checklistId: string,
    pointId: string,
    patch: Partial<TaskChecklistPoint>,
  ) =>
    updateChecklist(checklistId, (checklist) => ({
      ...checklist,
      items: checklist.items.map((item) =>
        item.id === pointId ? { ...item, ...patch } : item,
      ),
    }));

  const pickPhoto = (pointId: string) => {
    pendingItemId.current = pointId;
    fileInputRef.current?.click();
  };

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        multiple
        hidden
        onChange={async (event) => {
          const files = Array.from(event.target.files ?? []);
          const pointId = pendingItemId.current;

          event.target.value = '';

          if (pointId === null || files.length === 0) {
            return;
          }

          setUploadingItemId(pointId);

          try {
            for (const file of files) {
              await onUploadPhoto(pointId, file);
            }
          } finally {
            setUploadingItemId(null);
          }
        }}
      />
      {checklists.length === 0 && (
        <StyledFieldLabel>{t`Checklist`}</StyledFieldLabel>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {checklists.map((checklist) => {
          const done = checklist.items.filter((item) => item.done).length;
          const total = checklist.items.length;
          const titleDraft = drafts[`title:${checklist.id}`] ?? checklist.title;

          return (
            <StyledChecklist key={checklist.id}>
              <StyledChecklistHeader>
                <StyledTitleInput
                  aria-label={t`Checklist name`}
                  value={titleDraft}
                  onChange={(event) =>
                    setDrafts({
                      ...drafts,
                      [`title:${checklist.id}`]: event.target.value,
                    })
                  }
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      (event.target as HTMLInputElement).blur();
                    }
                  }}
                  onBlur={() => {
                    const { [`title:${checklist.id}`]: _drop, ...rest } =
                      drafts;

                    setDrafts(rest);

                    const next = titleDraft.trim();

                    if (next.length > 0 && next !== checklist.title) {
                      updateChecklist(checklist.id, (entry) => ({
                        ...entry,
                        title: next,
                      }));
                    }
                  }}
                />
                {total > 0 && (
                  <StyledCount>
                    {done}/{total}
                  </StyledCount>
                )}
                <StyledIconAction
                  type="button"
                  aria-label={t`Delete checklist`}
                  title={t`Delete checklist`}
                  onClick={() => updateChecklist(checklist.id, () => null)}
                >
                  <IconTrash size={14} />
                </StyledIconAction>
              </StyledChecklistHeader>
              {total > 0 && (
                <StyledProgress>
                  <StyledProgressFill
                    percent={Math.round((done / total) * 100)}
                  />
                </StyledProgress>
              )}

              {checklist.items.map((point) => {
                const draft = drafts[point.id] ?? point.text;
                const assignee = point.assigneeWorkspaceMemberId
                  ? membersById.get(point.assigneeWorkspaceMemberId)
                  : undefined;
                const dueStatus = getTaskDueStatus(point.dueAt, point.done);
                const photos = photosByItem.get(point.id) ?? [];

                return (
                  <StyledPoint key={point.id}>
                    <StyledPointRow>
                      <input
                        type="checkbox"
                        aria-label={t`Done: ${point.text}`}
                        checked={point.done}
                        onChange={() =>
                          updatePoint(checklist.id, point.id, {
                            done: !point.done,
                          })
                        }
                      />
                      <StyledPointText
                        isDone={point.done}
                        aria-label={t`Checklist item`}
                        value={draft}
                        onChange={(event) =>
                          setDrafts({
                            ...drafts,
                            [point.id]: event.target.value,
                          })
                        }
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            (event.target as HTMLInputElement).blur();
                          }
                        }}
                        onBlur={() => {
                          const { [point.id]: _drop, ...rest } = drafts;

                          setDrafts(rest);

                          const text = draft.trim();

                          if (text.length > 0 && text !== point.text) {
                            updatePoint(checklist.id, point.id, { text });
                          }
                        }}
                      />
                      {assignee !== undefined && (
                        <span title={assignee.fullName}>
                          <MemberAvatar member={assignee} size="xs" />
                        </span>
                      )}
                    </StyledPointRow>
                    <StyledPointMeta>
                      <StyledMiniSelect
                        aria-label={t`Who does it`}
                        value={point.assigneeWorkspaceMemberId ?? ''}
                        onChange={(event) =>
                          updatePoint(checklist.id, point.id, {
                            assigneeWorkspaceMemberId:
                              event.target.value || null,
                          })
                        }
                      >
                        <option value="">{t`Nobody`}</option>
                        {members.map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.fullName}
                          </option>
                        ))}
                      </StyledMiniSelect>
                      <StyledMiniDate
                        type="date"
                        aria-label={t`Due date`}
                        title={
                          point.dueAt
                            ? formatTaskDueDate(point.dueAt)
                            : t`Due date`
                        }
                        tone={
                          dueStatus === 'overdue'
                            ? 'danger'
                            : dueStatus === 'today' || dueStatus === 'soon'
                              ? 'warning'
                              : 'default'
                        }
                        value={dueInputValue(point.dueAt)}
                        onChange={(event) =>
                          updatePoint(checklist.id, point.id, {
                            dueAt: dueFromInputValue(event.target.value),
                          })
                        }
                      />
                      <StyledIconAction
                        className="point-action"
                        type="button"
                        aria-label={t`Add photo`}
                        disabled={uploadingItemId === point.id}
                        onClick={() => pickPhoto(point.id)}
                      >
                        <IconPhoto size={14} />
                        {uploadingItemId === point.id
                          ? t`Uploading…`
                          : t`Photo`}
                      </StyledIconAction>
                      <StyledIconAction
                        className="point-action"
                        type="button"
                        aria-label={t`Remove item`}
                        onClick={() =>
                          updateChecklist(checklist.id, (entry) => ({
                            ...entry,
                            items: entry.items.filter(
                              (item) => item.id !== point.id,
                            ),
                          }))
                        }
                      >
                        <IconTrash size={14} />
                      </StyledIconAction>
                    </StyledPointMeta>
                    {photos.length > 0 && (
                      <StyledPhotos>
                        {photos.map((photo) => (
                          <StyledPhoto key={photo.id}>
                            <a
                              href={photo.url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <img src={photo.url} alt={photo.name} />
                            </a>
                            <button
                              type="button"
                              aria-label={t`Delete photo`}
                              onClick={() => void onDeletePhoto(photo.id)}
                            >
                              ✕
                            </button>
                          </StyledPhoto>
                        ))}
                      </StyledPhotos>
                    )}
                  </StyledPoint>
                );
              })}

              <StyledTextInput
                aria-label={t`New checklist item`}
                placeholder={t`Add an item and press Enter`}
                value={newItems[checklist.id] ?? ''}
                onChange={(event) =>
                  setNewItems({
                    ...newItems,
                    [checklist.id]: event.target.value,
                  })
                }
                onKeyDown={(event) => {
                  const text = (newItems[checklist.id] ?? '').trim();

                  if (event.key === 'Enter' && text) {
                    setNewItems({ ...newItems, [checklist.id]: '' });
                    updateChecklist(checklist.id, (entry) => ({
                      ...entry,
                      items: [...entry.items, newPoint(text)],
                    }));
                  }
                }}
              />
            </StyledChecklist>
          );
        })}
      </div>
      <div style={{ marginTop: 10 }}>
        <Button
          title={t`Add checklist`}
          size="small"
          variant="secondary"
          Icon={IconPlus}
          onClick={() =>
            onChange([
              ...checklists,
              {
                id: v4(),
                title:
                  checklists.length === 0
                    ? t`Checklist`
                    : t`Checklist ${checklists.length + 1}`,
                items: [],
              },
            ])
          }
        />
        {checklists.length === 0 && (
          <StyledHint style={{ marginTop: 6 }}>
            {t`Split the work in steps and give each step its owner.`}
          </StyledHint>
        )}
      </div>
    </div>
  );
};
