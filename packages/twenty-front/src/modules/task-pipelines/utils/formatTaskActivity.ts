import { t } from '@lingui/core/macro';

type ActivityEvent = { type: string; [key: string]: unknown };

const PRIORITY_LABELS: Record<string, () => string> = {
  URGENT: () => t`Urgent`,
  HIGH: () => t`High`,
  MEDIUM: () => t`Medium`,
  LOW: () => t`Low`,
};

const RESOLUTION_LABELS: Record<string, () => string> = {
  EMAIL: () => t`matched by email`,
  ALIAS: () => t`matched by alias`,
  NAME: () => t`matched by name`,
  INVITEE: () => t`matched through the calendar invite`,
  MENTION: () => t`named in the action item`,
  SPEAKER: () => t`speaker at that moment`,
  SOLE_MEMBER: () => t`only member of the pipeline`,
  AI: () => t`action points by the local AI`,
  SUMMARY: () => t`from the summary's next steps`,
};

// Evento del historial (JSON del servidor) → frase en el idioma de quien lee.
// Los eventos antiguos eran texto plano: se muestran tal cual.
export const formatTaskActivity = (body: string): string => {
  let event: ActivityEvent;

  try {
    event = JSON.parse(body) as ActivityEvent;
  } catch {
    return body;
  }

  if (
    typeof event !== 'object' ||
    event === null ||
    typeof event.type !== 'string'
  ) {
    return body;
  }

  const text = (key: string) => String(event[key] ?? '');

  switch (event.type) {
    case 'created':
      return t`created this task`;
    case 'moved':
      return t`moved this to ${text('stage')}`;
    case 'assigned':
      return t`assigned this to ${text('name')}`;
    case 'unassigned':
      return t`removed the assignee`;
    case 'renamed':
      return t`renamed the task`;
    case 'description':
      return t`updated the description`;
    case 'due': {
      const date = new Date(text('date')).toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
      });

      return t`set the due date to ${date}`;
    }
    case 'dueCleared':
      return t`removed the due date`;
    case 'priority': {
      const label = PRIORITY_LABELS[text('priority')]?.() ?? text('priority');

      return t`set the priority to ${label}`;
    }
    case 'priorityCleared':
      return t`removed the priority`;
    case 'labelAdded':
      return t`added the label ${text('label')}`;
    case 'labelRemoved':
      return t`removed the label ${text('label')}`;
    case 'checklistAdded':
      return t`added “${text('text')}” to the checklist`;
    case 'checklistDone':
      return t`completed “${text('text')}”`;
    case 'checklistUndone':
      return t`reopened “${text('text')}”`;
    case 'memberAdded':
      return t`added ${text('name')} to the card`;
    case 'memberRemoved':
      return t`removed ${text('name')} from the card`;
    case 'start': {
      const date = new Date(text('date')).toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
      });

      return t`set the start date to ${date}`;
    }
    case 'startCleared':
      return t`removed the start date`;
    case 'checklistCreated':
      return t`added the checklist “${text('title')}”`;
    case 'checklistRemoved':
      return t`deleted the checklist “${text('title')}”`;
    case 'pointAssigned':
      return t`gave “${text('text')}” to ${text('name')}`;
    case 'attachmentAdded':
      return t`attached ${text('name')}`;
    case 'attachmentRemoved':
      return t`removed the attachment ${text('name')}`;
    case 'coverSet':
      return t`changed the cover`;
    case 'coverCleared':
      return t`removed the cover`;
    case 'archived':
      return t`archived this task`;
    case 'restored':
      return t`restored this task`;
    case 'fromMeeting': {
      const how =
        RESOLUTION_LABELS[text('resolution')]?.() ?? text('resolution');

      return t`created this from a meeting (${how})`;
    }
    case 'fromMeetingUnassigned':
      return t`created this from a meeting — nobody in this pipeline matched the assignee, please assign it`;
    default:
      return body;
  }
};
