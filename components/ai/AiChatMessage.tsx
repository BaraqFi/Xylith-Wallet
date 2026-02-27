import React from 'react';
import { LogEntry } from '@/lib/ai/types';
import clsx from 'clsx';
import { Sparkles } from 'lucide-react';

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
          <div className="inline-block bg-[color:var(--color-depth)] text-[color:var(--color-surface)] px-5 py-3 rounded-2xl rounded-br-none shadow-xl text-sm font-medium">
            {entry.content}
          </div>
        ) : (
          <div className="flex gap-3">
            <div className="w-6 h-6 rounded-full bg-[color:var(--color-depth)]/5 border border-[color:var(--color-border)] flex items-center justify-center shrink-0 mt-1">
              {entry.type === 'ERROR' ? <div className="w-2 h-2 bg-red-500 rounded-full" /> : <Sparkles size={12} className="text-[color:var(--color-depth)]/50" />}
            </div>
            <div className={clsx("text-sm font-medium leading-relaxed pt-1", entry.type === 'ERROR' ? "text-red-500" : "text-[color:var(--color-depth)]/90")}>
              {entry.content}
            </div>
          </div>
        )}

        <span className="text-[9px] text-[color:var(--color-depth)]/40 mt-1 block px-1 uppercase tracking-widest">
          {isUser ? "You" : "Xylith AI"}
        </span>
      </div>
    </div>
  );
};
