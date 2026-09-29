export type TaskPipelineRole = 'ADMIN' | 'MEMBER';
export type TaskPipelineVisibility = 'WORKSPACE' | 'PERSONAL';
export type TaskPriority = 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';

export type TaskPipelineStage = {
  id: string;
  name: string;
  color: string;
  position: number;
  isDone: boolean;
};

export type TaskPipelineMember = {
  workspaceMemberId: string;
  role: TaskPipelineRole;
  aliases: string[];
};

export type TaskPipelineLabel = { name: string; color: string };

export type TaskPipelineFathomConnection = {
  id: string;
  label: string;
  apiKeyHint: string;
  fathomUserEmail: string | null;
  status: string;
  lastError: string | null;
  lastSyncAt: string | null;
  lastMeetingAt: string | null;
  hasWebhook: boolean;
  connectedByWorkspaceMemberId: string | null;
};

export type TaskPipeline = {
  id: string;
  name: string;
  color: string;
  visibility: TaskPipelineVisibility;
  ownerWorkspaceMemberId: string;
  myRole: TaskPipelineRole;
  openTaskCount: number;
  labels: TaskPipelineLabel[];
  stages: TaskPipelineStage[];
  members: TaskPipelineMember[];
  fathomConnections: TaskPipelineFathomConnection[];
  createdAt: string;
};

export type TaskChecklistItem = { id: string; text: string; done: boolean };

// Punto de una checklist con su responsable y fecha (como Trello).
export type TaskChecklistPoint = {
  id: string;
  text: string;
  done: boolean;
  assigneeWorkspaceMemberId: string | null;
  dueAt: string | null;
  completedAt: string | null;
};

export type TaskChecklist = {
  id: string;
  title: string;
  items: TaskChecklistPoint[];
};

export type TaskAttachmentPurpose = 'ATTACHMENT' | 'CHECKLIST_ITEM' | 'INLINE';

export type TaskAttachment = {
  id: string;
  taskId: string;
  name: string;
  mimeType: string | null;
  size: number | null;
  purpose: TaskAttachmentPurpose;
  checklistItemId: string | null;
  isImage: boolean;
  url: string;
  uploadedByWorkspaceMemberId: string | null;
  createdAt: string;
};

export type TaskRelatedRecord = {
  objectNameSingular: string;
  recordId: string;
  label: string;
};

export type PipelineTask = {
  id: string;
  pipelineId: string;
  pipelineName: string;
  stageId: string;
  position: number;
  title: string;
  body: string;
  assigneeWorkspaceMemberId: string | null;
  memberWorkspaceMemberIds: string[];
  startAt: string | null;
  dueAt: string | null;
  priority: TaskPriority | null;
  labels: string[];
  checklist: TaskChecklistItem[];
  checklists: TaskChecklist[];
  checklistDoneCount: number;
  checklistTotalCount: number;
  attachments: TaskAttachment[];
  coverAttachmentId: string | null;
  coverUrl: string | null;
  relatedRecords: TaskRelatedRecord[];
  source: 'MANUAL' | 'EMAIL' | 'FATHOM';
  sourceLink: string | null;
  meeting: { id: string; title: string; startedAt: string | null } | null;
  originalText: string | null;
  needsAssignment: boolean;
  createdByWorkspaceMemberId: string | null;
  completedAt: string | null;
  archivedAt: string | null;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
};

export type PipelineTaskComment = {
  id: string;
  taskId: string;
  authorWorkspaceMemberId: string | null;
  kind: 'COMMENT' | 'ACTIVITY';
  body: string;
  createdAt: string;
  updatedAt: string;
};

export type MeetingListItem = {
  id: string;
  title: string;
  startedAt: string | null;
  endedAt: string | null;
  participantCount: number;
  actionItemCount: number;
  pipelineNames: string[];
  recordedByName: string | null;
  actionPointsStatus: MeetingActionPointsStatus;
};

export type MeetingActionPointsStatus =
  | 'NONE'
  | 'PENDING'
  | 'GENERATING'
  | 'DONE'
  | 'FAILED';

export type MeetingActionPointsState = {
  pipelineId: string;
  pipelineName: string;
  status: MeetingActionPointsStatus;
  trigger: 'AUTO' | 'MANUAL' | null;
  engine: 'AI' | 'SUMMARY' | null;
  error: string | null;
  requestedAt: string | null;
  finishedAt: string | null;
  taskIds: string[];
};

export type MeetingActionItem = {
  id: string;
  pipelineId: string;
  pipelineName: string;
  textEn: string;
  textEs: string | null;
  assigneeName: string | null;
  assigneeEmail: string | null;
  recordingTimestamp: string | null;
  playbackUrl: string | null;
  completed: boolean;
  resolvedWorkspaceMemberId: string | null;
  resolution: string | null;
  taskId: string | null;
  taskStageId: string | null;
  taskIsDone: boolean;
  checklistItemId: string | null;
  pointIsDone: boolean;
};

export type MeetingDetail = {
  id: string;
  recordingId: string;
  title: string;
  url: string | null;
  shareUrl: string | null;
  videoUrl: string | null;
  startedAt: string | null;
  endedAt: string | null;
  participants: {
    name: string | null;
    email: string | null;
    isExternal: boolean;
  }[];
  recordedByName: string | null;
  recordedByEmail: string | null;
  summaryMarkdown: string | null;
  summaryMarkdownEs: string | null;
  transcript: {
    speakerName: string | null;
    speakerEmail: string | null;
    timestamp: string;
    text: string;
  }[];
  actionItems: MeetingActionItem[];
  actionPoints: MeetingActionPointsState[];
};

export type CreatePipelineTaskInput = {
  pipelineId: string;
  stageId?: string | null;
  title: string;
  body?: string | null;
  assigneeWorkspaceMemberId?: string | null;
  memberWorkspaceMemberIds?: string[] | null;
  startAt?: string | null;
  dueAt?: string | null;
  priority?: TaskPriority | null;
  labels?: string[] | null;
  source?: 'MANUAL' | 'EMAIL' | null;
  sourceLink?: string | null;
  relatedRecords?: TaskRelatedRecord[] | null;
};

export type UpdatePipelineTaskInput = {
  title?: string | null;
  body?: string | null;
  assigneeWorkspaceMemberId?: string | null;
  clearAssignee?: boolean | null;
  memberWorkspaceMemberIds?: string[] | null;
  startAt?: string | null;
  clearStartAt?: boolean | null;
  dueAt?: string | null;
  clearDueAt?: boolean | null;
  priority?: TaskPriority | 'NONE' | null;
  labels?: string[] | null;
  checklist?: TaskChecklistItem[] | null;
  checklists?: TaskChecklistInput[] | null;
  coverAttachmentId?: string | null;
  clearCover?: boolean | null;
  relatedRecords?: TaskRelatedRecord[] | null;
  sourceLink?: string | null;
};

export type TaskChecklistInput = {
  id: string;
  title: string;
  items: {
    id: string;
    text: string;
    done: boolean;
    assigneeWorkspaceMemberId: string | null;
    dueAt: string | null;
  }[];
};
