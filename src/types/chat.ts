// Types for the MaxDiff result-analysis chatbot. It talks to the chatoctopus
// survey_session bot API (GET/PUT), same contract as coke_stills.

export interface ChatMessage {
  id?: string;
  type?: string;
  message: string;
  sender_type: "USER" | "BOT";
  timestamp?: string;
  additional_details?: Record<string, unknown>;
}

export interface ChatSessionResponse {
  messages: ChatMessage[];
  chat_session?: {
    config?: {
      next_input_type?: string[];
    };
  };
}

// A bot reply may arrive as a sections array (the backend's result-chat shape).
export type SectionType = "stats_text" | "stats_table" | "query";

export interface ChatSection {
  type: SectionType | string;
  content?: unknown;
  [key: string]: unknown;
}

/** GET /coke_eu/survey — the chat panel only needs the session id off it. */
export interface SurveyResponse {
  id: number;
  variant: string;
  title: string;
  job_number: string | null;
  status: string;
  total_response_count: number;
  /** Null when no chatoctopus session could be created for this account. */
  ai_survey: {
    result_analysis_chat_id: number;
    source: string;
  } | null;
}
