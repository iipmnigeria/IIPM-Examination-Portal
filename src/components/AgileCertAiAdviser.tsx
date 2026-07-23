import { FormEvent, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Bot,
  Loader2,
  MessageCircle,
  Send,
  ShieldAlert,
  Sparkles,
  UserRound,
  X,
} from 'lucide-react';
import {
  askAgileCertAdviser,
  type AgileCertAdviserHistoryMessage,
  type AgileCertAdviserRecommendation,
} from '../services/aiAdviserService';

type ChatMessage = AgileCertAdviserHistoryMessage & {
  id: string;
  recommendations?: AgileCertAdviserRecommendation[];
  escalationRequired?: boolean;
  suggestedActions?: string[];
};

const quickPrompts = [
  'Which modular certification fits a project manager?',
  'Explain examination and certificate fees.',
  'What is the difference between the two certificates?',
  'How do digital badges and LinkedIn sharing work?',
];

function messageId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function scrollToCandidateAccess() {
  const access = document.getElementById('candidate-access');
  if (access) access.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function openRecommendation(examinationId: string) {
  const examCard = document.getElementById(`exam-card-${examinationId}`);
  if (examCard) {
    examCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    examCard.classList.add('ring-4', 'ring-emerald-300', 'ring-offset-2');
    window.setTimeout(() => {
      examCard.classList.remove('ring-4', 'ring-emerald-300', 'ring-offset-2');
    }, 3_500);
    return;
  }

  window.dispatchEvent(
    new CustomEvent('agilecert-recommended-examination', {
      detail: { examinationId },
    }),
  );
  scrollToCandidateAccess();
}

export default function AgileCertAiAdviser() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const [remainingMessages, setRemainingMessages] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text:
        'Hello! I am the AgileCert Global AI Certification Adviser. I can recommend modular examinations, explain fees and credentials, and guide you to the next step. I will not disclose examination questions or answer keys.',
    },
  ]);
  const messageContainerRef = useRef<HTMLDivElement>(null);

  const history = useMemo<AgileCertAdviserHistoryMessage[]>(
    () => messages.filter((message) => message.id !== 'welcome').map(({ role, text }) => ({ role, text })),
    [messages],
  );

  const scrollToLatest = () => {
    window.requestAnimationFrame(() => {
      const container = messageContainerRef.current;
      if (container) container.scrollTop = container.scrollHeight;
    });
  };

  const sendMessage = async (messageText: string) => {
    const cleanMessage = messageText.trim();
    if (cleanMessage.length < 2 || isSending) return;

    const userMessage: ChatMessage = {
      id: messageId(),
      role: 'user',
      text: cleanMessage,
    };

    setMessages((current) => [...current, userMessage]);
    setInput('');
    setError('');
    setIsSending(true);
    scrollToLatest();

    try {
      const response = await askAgileCertAdviser({
        message: cleanMessage,
        history,
      });

      setMessages((current) => [
        ...current,
        {
          id: messageId(),
          role: 'assistant',
          text: response.answer,
          recommendations: response.recommendations,
          escalationRequired: response.escalationRequired,
          suggestedActions: response.suggestedActions,
        },
      ]);
      setRemainingMessages(
        typeof response.remainingMessages === 'number' ? response.remainingMessages : null,
      );
    } catch (sendError: any) {
      setError(sendError?.message || 'The AI Certification Adviser is temporarily unavailable.');
    } finally {
      setIsSending(false);
      scrollToLatest();
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void sendMessage(input);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-20 right-5 z-[95] flex items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-600 px-4 py-3 text-sm font-black text-white shadow-2xl transition hover:bg-emerald-700"
        aria-label="Open AgileCert AI Certification Adviser"
      >
        <MessageCircle className="h-5 w-5" />
        <span className="hidden sm:inline">Ask AgileCert AI</span>
      </button>

      {isOpen && (
        <section className="fixed bottom-4 right-4 z-[190] flex h-[min(760px,calc(100vh-2rem))] w-[min(430px,calc(100vw-2rem))] flex-col overflow-hidden rounded-3xl border border-slate-700 bg-white shadow-2xl">
          <header className="flex items-center justify-between bg-slate-950 px-5 py-4 text-white">
            <div className="flex items-center gap-3">
              <div className="relative rounded-xl bg-emerald-600 p-2.5">
                <Bot className="h-5 w-5" />
                <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-slate-950 bg-emerald-300" />
              </div>
              <div>
                <p className="text-sm font-black">AI Certification Adviser</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                  24/7 support · Powered by IIPM
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-full border border-slate-700 p-2 text-slate-300 hover:bg-slate-800 hover:text-white"
              aria-label="Close AI Certification Adviser"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          <div
            ref={messageContainerRef}
            className="flex-1 space-y-4 overflow-y-auto bg-slate-50 p-4"
          >
            {messages.map((message) => (
              <article
                key={message.id}
                className={`flex gap-2.5 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {message.role === 'assistant' && (
                  <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                    <Bot className="h-4 w-4" />
                  </div>
                )}

                <div className="max-w-[82%] space-y-3">
                  <div
                    className={`whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm ${
                      message.role === 'user'
                        ? 'rounded-br-md bg-slate-950 text-white'
                        : 'rounded-bl-md border border-slate-200 bg-white text-slate-700'
                    }`}
                  >
                    {message.text}
                  </div>

                  {message.recommendations?.map((recommendation) => (
                    <button
                      key={`${message.id}-${recommendation.examinationId}`}
                      type="button"
                      onClick={() => {
                        setIsOpen(false);
                        window.setTimeout(
                          () => openRecommendation(recommendation.examinationId),
                          100,
                        );
                      }}
                      className="block w-full rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-left transition hover:border-emerald-400 hover:bg-emerald-100"
                    >
                      <p className="text-xs font-black text-emerald-900">
                        {recommendation.title}
                      </p>
                      <p className="mt-1 text-[11px] leading-5 text-emerald-800">
                        {recommendation.reason}
                      </p>
                      <span className="mt-2 inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-emerald-700">
                        Explore examination <ArrowRight className="h-3 w-3" />
                      </span>
                    </button>
                  ))}

                  {message.escalationRequired && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
                      <p className="flex items-center gap-1.5 font-black">
                        <ShieldAlert className="h-4 w-4" /> Human support recommended
                      </p>
                      <p className="mt-1">
                        This matter needs authorised review. Use the support details in your candidate workspace or contact IIPM support.
                      </p>
                    </div>
                  )}

                  {message.suggestedActions && message.suggestedActions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {message.suggestedActions.map((action) => (
                        <button
                          key={`${message.id}-${action}`}
                          type="button"
                          onClick={() => void sendMessage(action)}
                          className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-bold text-slate-600 hover:border-emerald-300 hover:text-emerald-700"
                        >
                          {action}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {message.role === 'user' && (
                  <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-700">
                    <UserRound className="h-4 w-4" />
                  </div>
                )}
              </article>
            ))}

            {isSending && (
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="inline-flex items-center gap-2 rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-500 shadow-sm">
                  <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
                  Reviewing the certification catalogue...
                </div>
              </div>
            )}

            {error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-semibold leading-5 text-rose-700">
                {error}
              </div>
            )}
          </div>

          {messages.length === 1 && (
            <div className="border-t border-slate-200 bg-white px-4 py-3">
              <p className="mb-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">
                <Sparkles className="h-3 w-3 text-emerald-600" /> Try asking
              </p>
              <div className="grid gap-1.5">
                {quickPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => void sendMessage(prompt)}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-[11px] font-semibold text-slate-600 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="border-t border-slate-200 bg-white p-3">
            <div className="flex items-end gap-2 rounded-2xl border border-slate-300 bg-slate-50 p-2 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-100">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value.slice(0, 2000))}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void sendMessage(input);
                  }
                }}
                placeholder="Ask about certifications, fees or your next step..."
                rows={2}
                className="max-h-28 min-h-12 flex-1 resize-none bg-transparent px-2 py-1 text-sm text-slate-800 outline-none placeholder:text-slate-400"
              />
              <button
                type="submit"
                disabled={isSending || input.trim().length < 2}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Send adviser message"
              >
                {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
            <div className="mt-2 flex items-center justify-between px-1 text-[9px] text-slate-400">
              <span>AI assistance may be reviewed for quality and safety.</span>
              {remainingMessages !== null && <span>{remainingMessages} messages left this hour</span>}
            </div>
          </form>
        </section>
      )}
    </>
  );
}
