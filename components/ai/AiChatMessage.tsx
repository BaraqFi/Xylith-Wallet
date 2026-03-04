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
      <div className={clsx("max-w-[300px] md:max-w-md animate-in fade-in slide-in-from-bottom-2 duration-500", isUser ? "text-right" : "text-left")}>

        {isUser ? (
          <>
            <div className="inline-block bg-[color:var(--color-depth)] text-[color:var(--color-surface)] px-5 py-3 rounded-2xl rounded-br-none shadow-xl text-base font-medium">
              {entry.content}
            </div>
            <span className="text-[10px] text-[color:var(--color-depth)]/50 mt-2 block px-1 uppercase tracking-widest font-bold text-right">
              You
            </span>
          </>
        ) : (
          <div className="flex flex-col gap-1 items-start w-full">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-[color:var(--color-depth)]/10 border border-[color:var(--color-border)] flex items-center justify-center shrink-0 mt-0.5">
                {entry.type === 'ERROR' ? <div className="w-3 h-3 bg-red-500 rounded-full" /> : <Star size={18} className="text-[color:var(--color-depth)]/70" strokeWidth={2.5} />}
              </div>
              <div className={clsx("text-base font-medium leading-relaxed italic", entry.type === 'ERROR' ? "text-red-500" : "text-[color:var(--color-depth)]/90")}>
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
