'use client'

import { Bot, Sparkles, UserRound } from 'lucide-react'
import { useEffect, useRef } from 'react'

import type { ChatMessage } from '@/features/chat/types'

export function MessageList({ messages }: { messages: ChatMessage[] }) {
  const endRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div className="message-list" aria-live="polite">
      {messages.map((message) => (
        <article className={`message message--${message.role}`} key={message.id}>
          <div className="message-avatar" aria-hidden="true">
            {message.role === 'user' ? <UserRound size={17} /> : <Bot size={17} />}
          </div>
          <div className="message-body">
            <div className="message-meta">
              <span>{message.role === 'user' ? 'You' : 'Kovar Agent'}</span>
              {message.source === 'kovar' ? (
                <span className="source-pill source-pill--kovar">
                  <Sparkles size={11} /> Kovar{message.model ? ` · ${message.model}` : ''}
                </span>
              ) : null}
              {message.source === 'tool' ? <span className="source-pill">Tool result</span> : null}
            </div>
            <div className="message-content">
              {message.content || (message.isStreaming ? <span className="typing-dots">•••</span> : '')}
            </div>
          </div>
        </article>
      ))}
      <div ref={endRef} />
    </div>
  )
}
