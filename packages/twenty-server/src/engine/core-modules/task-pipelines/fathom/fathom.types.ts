// Forma del objeto Meeting de la API/webhook de Fathom (solo lo que usamos).
// https://developers.fathom.ai/api-reference/webhook-payloads/new-meeting-content-ready
export type FathomPerson = {
  name?: string | null;
  email?: string | null;
  team?: string | null;
};

export type FathomActionItem = {
  description?: string | null;
  user_generated?: boolean | null;
  completed?: boolean | null;
  recording_timestamp?: string | null;
  recording_playback_url?: string | null;
  assignee?: FathomPerson | null;
};

export type FathomTranscriptEntry = {
  speaker?: {
    display_name?: string | null;
    matched_calendar_invitee_email?: string | null;
  } | null;
  text?: string | null;
  timestamp?: string | null;
};

export type FathomMeeting = {
  recording_id?: number | string | null;
  title?: string | null;
  meeting_title?: string | null;
  url?: string | null;
  share_url?: string | null;
  created_at?: string | null;
  scheduled_start_time?: string | null;
  recording_start_time?: string | null;
  recording_end_time?: string | null;
  calendar_invitees?: (FathomPerson & { is_external?: boolean | null })[] | null;
  recorded_by?: FathomPerson | null;
  default_summary?: {
    template_name?: string | null;
    markdown_formatted?: string | null;
  } | null;
  transcript?: FathomTranscriptEntry[] | null;
  action_items?: FathomActionItem[] | null;
};
