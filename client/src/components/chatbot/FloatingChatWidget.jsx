import { startTransition, useMemo, useRef, useState } from 'react';

import { createChatbotReplyRequest } from '../../services/api';

const quickPrompts = [
  'Dowry law simple Hinglish mein samjhao',
  'Abhi kaunse practical steps lene chahiye?',
  'Evidence kaise safe rakhun?'
];

const initialMessages = [
  {
    id: 'welcome-message',
    role: 'assistant',
    content:
      'Namaste. Main aapki Hinglish support assistant hoon. Dowry laws aur next steps ke bare mein general guidance de sakti hoon. Please apna naam, phone number, exact address, ya exact GPS share mat karein.'
  }
];

function MessageBubble({ message }) {
  const isAssistant = message.role === 'assistant';

  return (
    <div className={`flex ${isAssistant ? 'justify-start' : 'justify-end'}`}>
      <div
        className={`max-w-[84%] rounded-[22px] px-4 py-3 text-sm leading-6 shadow-sm ${
          isAssistant
            ? 'rounded-bl-md border border-white/70 bg-white text-brand-900'
            : 'rounded-br-md bg-brand-950 text-white'
        }`}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
      </div>
    </div>
  );
}

export function FloatingChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const scrollContainerRef = useRef(null);

  const visibleMessages = useMemo(() => messages.slice(-14), [messages]);

  function scrollToBottom() {
    requestAnimationFrame(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
      }
    });
  }

  function toggleWidget() {
    setIsOpen((currentState) => !currentState);
    setErrorMessage('');
    scrollToBottom();
  }

  function handleQuickPrompt(prompt) {
    setDraft(prompt);
  }

  async function sendMessage(content) {
    const trimmedContent = content.trim();

    if (!trimmedContent || isSending) {
      return;
    }

    const nextUserMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmedContent
    };

    const nextMessages = [...messages, nextUserMessage];

    startTransition(() => {
      setMessages(nextMessages);
      setDraft('');
      setErrorMessage('');
    });
    setIsSending(true);
    scrollToBottom();

    try {
      const response = await createChatbotReplyRequest(
        nextMessages.map(({ role, content: text }) => ({ role, content: text }))
      );

      startTransition(() => {
        setMessages((currentMessages) => [
          ...currentMessages,
          {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: response.data.message
          }
        ]);
      });
      scrollToBottom();
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsSending(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    await sendMessage(draft);
  }

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 sm:bottom-6 sm:right-6">
      {isOpen ? (
        <div className="pointer-events-auto flex h-[min(78vh,640px)] w-[min(calc(100vw-2rem),390px)] flex-col overflow-hidden rounded-[30px] border border-white/80 bg-[linear-gradient(180deg,#f9fbfe_0%,#eef4fb_100%)] shadow-float sm:w-[390px]">
          <div className="bg-[linear-gradient(135deg,#10203f,#17376b)] px-5 py-4 text-white">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-trust-200">
                  Support assistant
                </p>
                <h2 className="mt-1 text-lg font-semibold">Hinglish Legal Guide</h2>
                <p className="mt-1 text-sm text-brand-100">
                  Trusted guidance for dowry-law awareness and next steps.
                </p>
              </div>

              <button
                type="button"
                onClick={toggleWidget}
                className="rounded-full bg-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/20"
              >
                Close
              </button>
            </div>
          </div>

          <div className="border-b border-brand-100 bg-white/80 px-4 py-3 text-xs leading-5 text-brand-600">
            Privacy note: naam, phone, exact address, aur exact GPS share mat karein. Yeh
            assistant general guidance deta hai, final legal advice nahi.
          </div>

          <div
            ref={scrollContainerRef}
            className="flex-1 space-y-3 overflow-y-auto bg-[radial-gradient(circle_at_top,rgba(61,150,239,0.08),transparent_35%),linear-gradient(180deg,#f7f9fd_0%,#edf3fb_100%)] px-4 py-4"
          >
            {visibleMessages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}

            {isSending ? (
              <div className="flex justify-start">
                <div className="rounded-[22px] rounded-bl-md border border-white/70 bg-white px-4 py-3 text-sm text-brand-600 shadow-sm">
                  Typing...
                </div>
              </div>
            ) : null}
          </div>

          <div className="border-t border-brand-100 bg-white px-4 py-3">
            <div className="mb-3 flex flex-wrap gap-2">
              {quickPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => handleQuickPrompt(prompt)}
                  className="rounded-full border border-trust-200 bg-trust-50 px-3 py-2 text-xs font-medium text-brand-800 transition hover:border-trust-300 hover:bg-trust-100"
                >
                  {prompt}
                </button>
              ))}
            </div>

            {errorMessage ? (
              <div className="mb-3 rounded-[20px] border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {errorMessage}
              </div>
            ) : null}

            <form className="flex items-end gap-3" onSubmit={handleSubmit}>
              <textarea
                rows="1"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Apna sawal Hinglish mein poochhiye..."
                className="field-input max-h-28 min-h-[48px] flex-1 resize-none"
              />
              <button
                type="submit"
                disabled={isSending || !draft.trim()}
                className="inline-flex h-12 items-center justify-center rounded-full bg-accent-500 px-5 text-sm font-semibold text-white transition hover:bg-accent-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Send
              </button>
            </form>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={toggleWidget}
        className="pointer-events-auto ml-auto flex h-16 w-16 items-center justify-center rounded-full bg-[linear-gradient(135deg,#18aaa2,#3d96ef)] text-sm font-semibold text-white shadow-float transition hover:scale-[1.02]"
      >
        Chat
      </button>
    </div>
  );
}
