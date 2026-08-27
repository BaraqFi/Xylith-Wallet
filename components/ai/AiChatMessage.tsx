import React from 'react';
import { LogEntry } from '@/lib/ai/types';
import clsx from 'clsx';
import { Star } from 'lucide-react';

interface ChatMessageProps {
  entry: LogEntry;
}

/**
 * Minimalist Message Component.
 * User messages are dark capsules.
 * AI messages are clean text with an icon.
 */
export const AiChatMessage: React.FC<ChatMessageProps> = ({ entry }) => {
  const isUser = entry.type === 'USER';

  // Skip pure system logs in the visual chat unless they are errors
  if (entry.type === 'SYSTEM') return null;

  return (
    <div className={clsx("flex w-full mb-6", isUser ? "justify-end" : "justify-start")}>
      {/* Percentage, not a fixed 300px: on a 320px screen the old value was
          wider than the padded content area, so bubbles ran off the edge. */}
      <div className={clsx("max-w-[85%] md:max-w-md min-w-0 animate-in fade-in slide-in-from-bottom-2 duration-500", isUser ? "text-right" : "text-left")}>

        {isUser ? (
          <>
            {/* Agent output includes addresses and hashes with no spaces —
                without wrapping they force the bubble past the screen edge. */}
            <div className="inline-block max-w-full whitespace-pre-line break-words text-left bg-[color:var(--color-depth)] text-[color:var(--color-surface)] px-5 py-3 rounded-2xl rounded-br-none shadow-xl text-base font-medium">
              {entry.content}
            </div>
            <span className="text-[10px] text-[color:var(--color-depth)]/50 mt-2 block px-1 uppercase tracking-widest font-bold text-right">
              You
            </span>
          </>
        ) : (
          <div className="flex flex-col gap-1 items-start w-full">
            <div className="flex items-start gap-3 w-full min-w-0">
              <div className="w-8 h-8 rounded-full bg-[color:var(--color-depth)]/10 border border-[color:var(--color-border)] flex items-center justify-center shrink-0 mt-0.5">
                {entry.type === 'ERROR' ? <div className="w-3 h-3 bg-red-500 rounded-full" /> : <Star size={18} className="text-[color:var(--color-depth)]/70" strokeWidth={2.5} />}
              </div>
              {/* whitespace-pre-line keeps the line breaks in multi-line replies
                  (/tokens, /history) — without it they collapsed into one run-on
                  paragraph. min-w-0 + break-words stop long hashes overflowing. */}
              <div className={clsx(
                "min-w-0 flex-1 whitespace-pre-line break-words text-base font-medium leading-relaxed italic",
                entry.type === 'ERROR' ? "text-red-500" : "text-[color:var(--color-depth)]/90"
              )}>
                {entry.content}
              </div>
            </div>
            <span className="text-[10px] text-[color:var(--color-depth)]/50 mt-1 uppercase tracking-widest font-bold self-start pl-11">
              Xylith AI
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
