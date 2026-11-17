import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useQuery } from "@tanstack/react-query";
import { ArrowUp, RefreshCcw, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { getAccountId } from "@/lib/auth";
import { getSurvey } from "@/services/api";
import { fetchChatSession, postChatMessage } from "@/services/chat";
import type { ChatMessage, ChatSection } from "@/types/chat";

/**
 * Analyst chat for the MaxDiff dashboard. Talks to the chatoctopus
 * survey_session bot API (GET to load, PUT to enqueue a turn), exactly like
 * coke_stills — the session id is resolved from
 * AISurvey.result_analysis_chat_id, so the conversation persists server-side
 * across reloads.
 *
 * Chatoctopus stores the USER turn before invoking the bot webhook and appends
 * the BOT reply when done, so "a reply is being generated" is derivable from
 * the session itself: a trailing USER message with no BOT reply. We derive the
 * input lock + loading bubble from that (not just local state) and poll while
 * it holds, so a page refresh mid-turn restores the pending UI instead of
 * letting a second message be typed.
 */
const POLL_MS = 4000;
// If the bot never replies (webhook crashed), unlock the input after this long
// rather than leaving the chat stuck on a dead trailing USER turn.
const PENDING_MAX_AGE_MS = 5 * 60 * 1000;

// Shown on the empty state. Chosen to cover the four parts of the dashboard —
// ranking, segments, associations, TURF — so a first-time reader discovers what
// the assistant can reach rather than guessing at it.
const STARTERS = [
  "Which benefits matter most, and how much of that is just energy?",
  "How does Gen Z differ from everyone else?",
  "What's the best 5-benefit portfolio, and what does it gain over the top five?",
  "Which ingredients do people link to immune support?",
  "What does the need-state segment table actually show?",
];

function isAwaitingBot(messages: ChatMessage[]): boolean {
  const last = messages[messages.length - 1];
  if (!last || last.sender_type !== "USER") return false;
  const ts = last.timestamp ? Date.parse(last.timestamp) : NaN;
  return Number.isNaN(ts) || Date.now() - ts < PENDING_MAX_AGE_MS;
}

export function ChatPanel({ surveyId }: { surveyId?: number }) {
  // The account is part of the cache key, not just an implicit header. Sessions
  // are per account, so a cached session id from one account must never be
  // handed to another — login()/logout() do clear the cache, but keying on the
  // account means this holds even if some future path forgets to.
  const accountId = getAccountId();
  const surveyQuery = useQuery({
    queryKey: ["survey", accountId, surveyId ?? "variant"],
    queryFn: () => getSurvey(surveyId),
    staleTime: 5 * 60 * 1000,
  });

  // chat_id may come back as an int (Django IntegerField) or a string; coerce
  // to string since chatoctopus uses it as a URL path segment. The model
  // defaults to -1, which means "no session", not "session zero".
  const rawChatId = surveyQuery.data?.ai_survey?.result_analysis_chat_id ?? null;
  const chatId =
    rawChatId !== null && rawChatId !== undefined && Number(rawChatId) >= 0
      ? String(rawChatId)
      : null;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Server-derived pending state — survives refresh, unlike isLoading.
  const awaitingBot = isAwaitingBot(messages);
  const busy = isLoading || awaitingBot;

  useEffect(() => {
    setMessages([]);
    setInput("");
  }, [surveyId, chatId]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, isLoading]);

  const loadMessages = async () => {
    if (!chatId) return;
    try {
      const resp = await fetchChatSession(chatId);
      setMessages(resp.messages || []);
    } catch (err) {
      toast.error(errorText(err) ?? "Failed to load chat messages");
    }
  };

  // Initial load once the session id is known.
  useEffect(() => {
    if (!chatId) return;
    setIsLoading(true);
    (async () => {
      await loadMessages();
      setIsLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId]);

  // Recovery poll: only when a turn is pending that THIS tab has no in-flight
  // PUT for (page was refreshed mid-turn, or the PUT connection dropped). A
  // normal send needs no polling — its awaited PUT returns exactly when the
  // reply is stored — so this stays idle during regular use.
  useEffect(() => {
    if (!chatId || !awaitingBot || isLoading) return;
    const timer = setInterval(async () => {
      try {
        const resp = await fetchChatSession(chatId);
        const next = resp.messages || [];
        // Keep the previous array when nothing changed so we don't re-render
        // (and re-scroll) on every poll tick — except once the pending turn
        // goes stale, when a re-render is needed to unlock the input.
        setMessages((prev) => {
          const unchanged =
            prev.length === next.length &&
            prev[prev.length - 1]?.id === next[next.length - 1]?.id;
          if (!unchanged) return next;
          return isAwaitingBot(prev) ? prev : [...prev];
        });
      } catch {
        // Transient poll failure — keep polling.
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [chatId, awaitingBot, isLoading]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || !chatId || busy) return;
    // Optimistic echo with a timestamp so isAwaitingBot() locks the input
    // immediately; replaced by server truth on the next load.
    setMessages((prev) => [
      ...prev,
      {
        message: text,
        type: "MESSAGE",
        sender_type: "USER",
        timestamp: new Date().toISOString(),
      },
    ]);
    setInput("");
    setIsLoading(true);
    try {
      await postChatMessage(chatId, text);
    } catch (err) {
      toast.error(errorText(err) ?? "Failed to send message");
    } finally {
      // Resync with the server either way: on success this pulls the bot
      // reply; on a client-side failure/timeout it pulls whatever chatoctopus
      // actually stored, and the poll above takes over if the turn is still
      // being processed server-side.
      await loadMessages();
      setIsLoading(false);
    }
  };

  return (
    <section className="flex h-full w-full min-w-0 flex-col bg-card">
      {surveyQuery.isPending ? (
        <div className="flex flex-1 items-center justify-center font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
          Loading chat session…
        </div>
      ) : !chatId ? (
        <div className="flex flex-1 items-center justify-center p-6 text-center text-xs text-muted-foreground">
          <div className="max-w-md">
            <Sparkles className="mx-auto mb-2 h-5 w-5 text-muted-foreground/60" />
            <div className="text-sm font-semibold text-foreground">No chat session</div>
            <p className="mt-1 leading-relaxed">
              No chat session has been provisioned for this account on this study. Sessions are
              created from the backend, one per account, so the conversation stays private to
              you — ask an administrator to set one up.
            </p>
            <button
              onClick={() => surveyQuery.refetch()}
              className="mt-3 inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-widest hover:border-coke-red hover:text-coke-red"
            >
              <RefreshCcw className="h-3 w-3" /> Retry
            </button>
          </div>
        </div>
      ) : (
        <>
          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-3xl space-y-6 px-6 pt-8 pb-6">
              {messages.length === 0 && !busy && <EmptyState onPick={sendMessage} />}
              {messages.map((m, i) => (
                <ChatBubble key={m.id ?? i} message={m} onQueryClick={sendMessage} />
              ))}
              {busy && <LoadingBubble />}
            </div>
          </div>

          <div className="shrink-0 border-t bg-card">
            <div className="mx-auto w-full max-w-3xl px-6 pt-4 pb-5">
              <div className="relative rounded-3xl border border-input bg-background shadow-sm transition focus-within:border-coke-red/40 focus-within:shadow-md">
                <textarea
                  rows={1}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage(input);
                    }
                  }}
                  placeholder={
                    busy
                      ? "Waiting for the current answer…"
                      : "Ask about benefits, markets, segments, associations, TURF…"
                  }
                  disabled={busy}
                  className="block max-h-[200px] min-h-[52px] w-full resize-none rounded-3xl bg-transparent px-5 py-4 pr-14 text-sm placeholder:text-muted-foreground focus:outline-none disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => sendMessage(input)}
                  disabled={!input.trim() || busy}
                  aria-label="Send"
                  className="absolute bottom-2.5 right-2.5 flex h-9 w-9 items-center justify-center rounded-full bg-coke-red text-white transition hover:bg-coke-deep disabled:bg-muted disabled:text-muted-foreground"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-2 text-center text-[10px] leading-relaxed text-muted-foreground">
                Answers are computed from the same endpoints the dashboard reads, so a figure
                here and a figure on the dashboard agree. Preference shares are relative.
              </p>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function errorText(err: unknown): string | undefined {
  const e = err as { response?: { data?: { error?: string; message?: string } } };
  return e?.response?.data?.error ?? e?.response?.data?.message;
}

function EmptyState({ onPick }: { onPick: (q: string) => void }) {
  return (
    <div className="py-10 text-center">
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-coke-red to-coke-deep text-white shadow-sm">
        <Sparkles className="h-5 w-5" />
      </div>
      <div className="text-sm font-semibold">Ask about this study</div>
      <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">
        Every cut the filter rail can express, this can too — market, generation, gender, age,
        income, area and need-state.
      </p>
      <div className="mt-5 flex flex-col items-stretch gap-1.5">
        {STARTERS.map((q) => (
          <button
            key={q}
            onClick={() => onPick(q)}
            className="rounded-lg border bg-background px-3 py-2 text-left text-xs leading-snug transition hover:border-coke-red/40 hover:bg-coke-red/[0.04]"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Bot reply parsing ──────────────────────────────────────────────
// A bot turn's `message` may be a plain markdown string OR a JSON sections
// array (the backend's result-chat shape). Python reprs (single quotes,
// True/False/None) are tolerated.
function isSectionsArray(val: unknown): val is ChatSection[] {
  return (
    Array.isArray(val) &&
    val.length > 0 &&
    val.every(
      (s) => s && typeof s === "object" && typeof (s as ChatSection).type === "string"
    )
  );
}

function pythonToJson(s: string): string {
  return s
    .replace(/\bTrue\b/g, "true")
    .replace(/\bFalse\b/g, "false")
    .replace(/\bNone\b/g, "null");
}

function tryParseSections(msg: string): ChatSection[] | null {
  if (!msg || msg.trim()[0] !== "[") return null;
  for (const candidate of [msg, pythonToJson(msg)]) {
    try {
      const parsed = JSON.parse(candidate);
      if (isSectionsArray(parsed)) return parsed;
    } catch {
      /* try next */
    }
  }
  return null;
}

// Resolve a bot turn's sections from wherever the backend put them: a JSON
// sections array in `message`, `additional_details.sections`, or an
// `additional_details` that is itself a sections array.
function botSections(m: ChatMessage): ChatSection[] | null {
  const fromMessage = m.message ? tryParseSections(m.message) : null;
  if (fromMessage) return fromMessage;
  const ad = m.additional_details as { sections?: unknown } | ChatSection[] | undefined;
  if (ad) {
    if (isSectionsArray((ad as { sections?: unknown }).sections))
      return (ad as { sections: ChatSection[] }).sections;
    if (isSectionsArray(ad)) return ad as ChatSection[];
  }
  return null;
}

function Markdown({ children }: { children: string }) {
  // Defensive: the model occasionally writes a literal backslash-n instead of
  // a real newline; unescape so markdown still sees paragraph breaks.
  const text = children.includes("\\n") ? children.replace(/\\n/g, "\n") : children;
  return (
    <div className="prose prose-sm max-w-none prose-p:my-1.5 prose-headings:my-2 prose-table:my-2 prose-th:px-2 prose-th:py-1 prose-td:px-2 prose-td:py-1 prose-table:text-xs prose-td:font-mono prose-code:font-mono [--tw-prose-body:hsl(var(--foreground))] [--tw-prose-headings:hsl(var(--foreground))] [--tw-prose-bold:hsl(var(--foreground))] [--tw-prose-li:hsl(var(--foreground))]">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  );
}

function SectionView({
  section,
  onQueryClick,
}: {
  section: ChatSection;
  onQueryClick?: (q: string) => void;
}) {
  if (section.type === "stats_text" && typeof section.content === "string") {
    return <Markdown>{section.content}</Markdown>;
  }
  if (section.type === "query") {
    const queries = Array.isArray(section.content) ? (section.content as string[]) : [];
    if (!queries.length) return null;
    return (
      <div className="mt-2 flex flex-wrap gap-1.5">
        {queries.map((q, i) => (
          <button
            key={i}
            onClick={() => onQueryClick?.(q)}
            className="rounded-full border border-foreground/25 bg-background px-2.5 py-1 text-xs font-medium text-foreground transition hover:border-coke-red/40 hover:bg-coke-red/5"
          >
            {q}
          </button>
        ))}
      </div>
    );
  }
  // Unknown section kind — show raw so nothing is silently dropped.
  return (
    <pre className="overflow-x-auto rounded bg-muted/60 p-2 text-[11px]">
      {JSON.stringify(section, null, 2)}
    </pre>
  );
}

function ChatBubble({
  message,
  onQueryClick,
}: {
  message: ChatMessage;
  onQueryClick?: (q: string) => void;
}) {
  const isUser = message.sender_type === "USER";

  if (isUser) {
    return (
      <div className="flex w-full justify-end gap-3">
        <div className="max-w-[75%] break-words rounded-3xl bg-coke-red px-4 py-2.5 text-sm text-white shadow-sm">
          {message.message}
        </div>
      </div>
    );
  }

  const sections = botSections(message);

  return (
    <div className="flex w-full gap-3">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-coke-red to-coke-deep text-white shadow-sm">
        <Sparkles className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1 space-y-2 break-words rounded-2xl border bg-card px-4 py-3 text-sm shadow-sm">
        {sections ? (
          sections.map((s, i) => (
            <SectionView key={i} section={s} onQueryClick={onQueryClick} />
          ))
        ) : message.message ? (
          <Markdown>{message.message}</Markdown>
        ) : (
          <span className="text-muted-foreground">(no content)</span>
        )}
      </div>
    </div>
  );
}

// Status chips shown while a reply is pending. Sequenced client-side — there is
// no websocket progress channel — and worded after what the agent loop actually
// does, so a long wait reads as work rather than as a hang.
const STATUS_STEPS = [
  "Reading your question…",
  "Working out the right cut…",
  "Querying the MaxDiff model…",
  "Crunching the numbers…",
  "Writing up the answer…",
];
const STATUS_STEP_MS = 8000;
const TYPE_CHAR_MS = 30;

function LoadingBubble() {
  const [step, setStep] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const text = STATUS_STEPS[step];

  // Advance to the next stage every STATUS_STEP_MS; hold on the last one.
  useEffect(() => {
    if (step >= STATUS_STEPS.length - 1) return;
    const t = setTimeout(() => {
      setStep((s) => s + 1);
      setCharCount(0);
    }, STATUS_STEP_MS);
    return () => clearTimeout(t);
  }, [step]);

  // Typewriter: reveal the current stage one character at a time.
  useEffect(() => {
    if (charCount >= text.length) return;
    const t = setTimeout(() => setCharCount((c) => c + 1), TYPE_CHAR_MS);
    return () => clearTimeout(t);
  }, [charCount, text]);

  return (
    <div className="flex w-full gap-3">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-coke-red to-coke-deep text-white shadow-sm">
        <Sparkles className="h-4 w-4" />
      </div>
      <div className="flex items-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-coke-red/20 bg-coke-red/[0.05] px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground shadow-sm">
          {text.slice(0, charCount)}
          <span className="inline-block h-3 w-[2px] animate-pulse rounded-full bg-coke-red" />
        </span>
      </div>
    </div>
  );
}
