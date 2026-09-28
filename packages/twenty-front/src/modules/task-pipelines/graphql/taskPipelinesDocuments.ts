import { gql } from '@apollo/client';

export const TASK_PIPELINE_FIELDS = gql`
  fragment TaskPipelineFields on TaskPipeline {
    id
    name
    color
    visibility
    ownerWorkspaceMemberId
    myRole
    openTaskCount
    createdAt
    labels {
      name
      color
    }
    stages {
      id
      name
      color
      position
      isDone
    }
    members {
      workspaceMemberId
      role
      aliases
    }
    fathomConnections {
      id
      label
      apiKeyHint
      fathomUserEmail
      status
      lastError
      lastSyncAt
      lastMeetingAt
      hasWebhook
      connectedByWorkspaceMemberId
    }
  }
`;

export const PIPELINE_TASK_FIELDS = gql`
  fragment PipelineTaskFields on TaskPipelineTask {
    id
    pipelineId
    pipelineName
    stageId
    position
    title
    body
    assigneeWorkspaceMemberId
    dueAt
    priority
    labels
    checklist {
      id
      text
      done
    }
    relatedRecords {
      objectNameSingular
      recordId
      label
    }
    source
    sourceLink
    meeting {
      id
      title
      startedAt
    }
    originalText
    needsAssignment
    createdByWorkspaceMemberId
    completedAt
    archivedAt
    commentCount
    createdAt
    updatedAt
  }
`;

export const GET_TASK_PIPELINES = gql`
  ${TASK_PIPELINE_FIELDS}
  query TaskPipelines {
    taskPipelines {
      ...TaskPipelineFields
    }
    canCreateWorkspaceTaskPipelines
  }
`;

export const CREATE_TASK_PIPELINE = gql`
  ${TASK_PIPELINE_FIELDS}
  mutation CreateTaskPipeline($input: CreateTaskPipelineInput!) {
    createTaskPipeline(input: $input) {
      ...TaskPipelineFields
    }
  }
`;

export const UPDATE_TASK_PIPELINE = gql`
  ${TASK_PIPELINE_FIELDS}
  mutation UpdateTaskPipeline(
    $pipelineId: UUID!
    $input: UpdateTaskPipelineInput!
  ) {
    updateTaskPipeline(pipelineId: $pipelineId, input: $input) {
      ...TaskPipelineFields
    }
  }
`;

export const DELETE_TASK_PIPELINE = gql`
  mutation DeleteTaskPipeline($pipelineId: UUID!) {
    deleteTaskPipeline(pipelineId: $pipelineId)
  }
`;

export const SAVE_TASK_PIPELINE_STAGES = gql`
  ${TASK_PIPELINE_FIELDS}
  mutation SaveTaskPipelineStages(
    $pipelineId: UUID!
    $stages: [TaskPipelineStageInput!]!
    $moveTasksToStageId: UUID
  ) {
    saveTaskPipelineStages(
      pipelineId: $pipelineId
      stages: $stages
      moveTasksToStageId: $moveTasksToStageId
    ) {
      ...TaskPipelineFields
    }
  }
`;

export const ADD_TASK_PIPELINE_MEMBER = gql`
  ${TASK_PIPELINE_FIELDS}
  mutation AddTaskPipelineMember(
    $pipelineId: UUID!
    $memberWorkspaceMemberId: UUID!
    $role: String!
  ) {
    addTaskPipelineMember(
      pipelineId: $pipelineId
      memberWorkspaceMemberId: $memberWorkspaceMemberId
      role: $role
    ) {
      ...TaskPipelineFields
    }
  }
`;

export const UPDATE_TASK_PIPELINE_MEMBER = gql`
  ${TASK_PIPELINE_FIELDS}
  mutation UpdateTaskPipelineMember(
    $pipelineId: UUID!
    $memberWorkspaceMemberId: UUID!
    $role: String
    $aliases: [String!]
  ) {
    updateTaskPipelineMember(
      pipelineId: $pipelineId
      memberWorkspaceMemberId: $memberWorkspaceMemberId
      role: $role
      aliases: $aliases
    ) {
      ...TaskPipelineFields
    }
  }
`;

export const REMOVE_TASK_PIPELINE_MEMBER = gql`
  mutation RemoveTaskPipelineMember(
    $pipelineId: UUID!
    $memberWorkspaceMemberId: UUID!
  ) {
    removeTaskPipelineMember(
      pipelineId: $pipelineId
      memberWorkspaceMemberId: $memberWorkspaceMemberId
    )
  }
`;

export const GET_PIPELINE_TASKS = gql`
  ${PIPELINE_TASK_FIELDS}
  query TaskPipelineTasks($pipelineId: UUID!, $includeArchived: Boolean) {
    taskPipelineTasks(
      pipelineId: $pipelineId
      includeArchived: $includeArchived
    ) {
      ...PipelineTaskFields
    }
  }
`;

export const GET_MY_PIPELINE_TASKS = gql`
  ${PIPELINE_TASK_FIELDS}
  query MyTaskPipelineTasks {
    myTaskPipelineTasks {
      ...PipelineTaskFields
    }
  }
`;

export const GET_PIPELINE_TASK = gql`
  ${PIPELINE_TASK_FIELDS}
  query TaskPipelineTask($taskId: UUID!) {
    taskPipelineTask(taskId: $taskId) {
      ...PipelineTaskFields
    }
  }
`;

export const CREATE_PIPELINE_TASK = gql`
  ${PIPELINE_TASK_FIELDS}
  mutation CreateTaskPipelineTask($input: CreateTaskPipelineTaskInput!) {
    createTaskPipelineTask(input: $input) {
      ...PipelineTaskFields
    }
  }
`;

export const UPDATE_PIPELINE_TASK = gql`
  ${PIPELINE_TASK_FIELDS}
  mutation UpdateTaskPipelineTask(
    $taskId: UUID!
    $input: UpdateTaskPipelineTaskInput!
  ) {
    updateTaskPipelineTask(taskId: $taskId, input: $input) {
      ...PipelineTaskFields
    }
  }
`;

export const MOVE_PIPELINE_TASK = gql`
  ${PIPELINE_TASK_FIELDS}
  mutation MoveTaskPipelineTask($input: MoveTaskPipelineTaskInput!) {
    moveTaskPipelineTask(input: $input) {
      ...PipelineTaskFields
    }
  }
`;

export const SET_PIPELINE_TASK_ARCHIVED = gql`
  ${PIPELINE_TASK_FIELDS}
  mutation SetTaskPipelineTaskArchived($taskId: UUID!, $archived: Boolean!) {
    setTaskPipelineTaskArchived(taskId: $taskId, archived: $archived) {
      ...PipelineTaskFields
    }
  }
`;

export const DELETE_PIPELINE_TASK = gql`
  mutation DeleteTaskPipelineTask($taskId: UUID!) {
    deleteTaskPipelineTask(taskId: $taskId)
  }
`;

export const GET_PIPELINE_TASK_COMMENTS = gql`
  query TaskPipelineTaskComments($taskId: UUID!) {
    taskPipelineTaskComments(taskId: $taskId) {
      id
      taskId
      authorWorkspaceMemberId
      kind
      body
      createdAt
      updatedAt
    }
  }
`;

export const ADD_PIPELINE_TASK_COMMENT = gql`
  mutation AddTaskPipelineTaskComment($taskId: UUID!, $body: String!) {
    addTaskPipelineTaskComment(taskId: $taskId, body: $body) {
      id
    }
  }
`;

export const UPDATE_PIPELINE_TASK_COMMENT = gql`
  mutation UpdateTaskPipelineTaskComment($commentId: UUID!, $body: String!) {
    updateTaskPipelineTaskComment(commentId: $commentId, body: $body) {
      id
    }
  }
`;

export const DELETE_PIPELINE_TASK_COMMENT = gql`
  mutation DeleteTaskPipelineTaskComment($commentId: UUID!) {
    deleteTaskPipelineTaskComment(commentId: $commentId)
  }
`;

export const CONNECT_FATHOM = gql`
  mutation ConnectFathomToTaskPipeline(
    $pipelineId: UUID!
    $label: String!
    $apiKey: String!
  ) {
    connectFathomToTaskPipeline(
      pipelineId: $pipelineId
      label: $label
      apiKey: $apiKey
    ) {
      id
    }
  }
`;

export const DISCONNECT_FATHOM = gql`
  mutation DisconnectFathomFromTaskPipeline($connectionId: UUID!) {
    disconnectFathomFromTaskPipeline(connectionId: $connectionId)
  }
`;

export const SYNC_FATHOM = gql`
  mutation SyncFathomConnection($connectionId: UUID!) {
    syncFathomConnection(connectionId: $connectionId) {
      meetingsProcessed
      tasksCreated
      actionItemsSeen
      error
    }
  }
`;

export const GET_MEETINGS = gql`
  query TaskPipelineMeetings($pipelineId: UUID) {
    taskPipelineMeetings(pipelineId: $pipelineId) {
      id
      title
      startedAt
      endedAt
      participantCount
      actionItemCount
      pipelineNames
      recordedByName
    }
  }
`;

export const GET_MEETING = gql`
  query TaskPipelineMeeting($meetingId: UUID!) {
    taskPipelineMeeting(meetingId: $meetingId) {
      id
      recordingId
      title
      url
      shareUrl
      videoUrl
      startedAt
      endedAt
      participants {
        name
        email
        isExternal
      }
      recordedByName
      recordedByEmail
      summaryMarkdown
      summaryMarkdownEs
      transcript {
        speakerName
        speakerEmail
        timestamp
        text
      }
      actionItems {
        id
        pipelineId
        pipelineName
        textEn
        textEs
        assigneeName
        assigneeEmail
        recordingTimestamp
        playbackUrl
        completed
        resolvedWorkspaceMemberId
        resolution
        taskId
        taskStageId
        taskIsDone
      }
    }
  }
`;

export const CREATE_TASK_FROM_ACTION_ITEM = gql`
  mutation CreateTaskFromMeetingActionItem($actionItemId: UUID!) {
    createTaskFromMeetingActionItem(actionItemId: $actionItemId) {
      id
    }
  }
`;
