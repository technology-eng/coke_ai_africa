// Single source of truth for the backend base URL. Toggle local↔prod by
// commenting/uncommenting so the switch is one line and DevTools shows the
// real upstream URL (no proxy hop).
//
// The coke_eu Flask service mounts every route under /coke_eu/ (see
// python_services/admin_management/service_app.py) and runs on 4011 locally.
// export const API_BASE_URL = 'http://127.0.0.1:4011/coke_eu';
export const API_BASE_URL = 'https://ancillarygcp-prod.smytten.com/coke_eu';

// Every endpoint accepts a survey-less form that resolves the survey from
// ?variant=, so the dashboard can boot without knowing a survey id. BENEFITS
// is the MaxDiff questionnaire; the ingredients variant reuses the same routes.
export const SURVEY_VARIANT = 'BENEFITS';

// Chatoctopus session endpoint — the analyst chatbot talks to this, on a
// separate host from the MaxDiff API. Same contract as coke_stills:
//   GET  /<chatId>/?source=BOT       → messages + chat_session.config
//   PUT  /<chatId>/  {user_message}  → enqueues a turn (the bot replies into
//                                      the session by calling coke_eu's
//                                      /coke_eu/survey/<id>/result-chat/)
// The chatId is read off `ai_survey.result_analysis_chat_id` from
// GET /coke_eu/survey.
export const CHAT_BASE_URL =
  'https://ancillarygcp-prod.smytten.com/chatoctopus/survey_session';
