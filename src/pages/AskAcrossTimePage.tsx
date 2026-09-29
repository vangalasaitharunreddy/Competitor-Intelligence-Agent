import React, { useState } from 'react';
import {
  MessageSquareText,
  Send,
  Brain,
  Sparkles,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  FileText,
  ExternalLink,
  Info,
  Clock,
} from 'lucide-react';
import {
  AskQuestionResponse,
  Competitor,
} from '../types/intelligence.ts';

interface AskAcrossTimePageProps {
  competitors: Competitor[];
  onAskQuestion: (
    question: string,
    competitorId?: string,
    conversationId?: string
  ) => Promise<AskQuestionResponse>;
  onOpenEvidence: (evidenceId: string) => void;
  demoClockDate: string;
}

interface MessageHistoryItem {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  response?: AskQuestionResponse['answer'];
  mode?: AskQuestionResponse['mode'];
  timestamp: string;
}

export const AskAcrossTimePage: React.FC<AskAcrossTimePageProps> = ({
  competitors,
  onAskQuestion,
  onOpenEvidence,
  demoClockDate,
}) => {
  const [messages, setMessages] = useState<MessageHistoryItem[]>([
    {
      id: 'msg-welcome',
      sender: 'agent',
      text: `Hello! I am CompetitorLens with persistent Hindsight memory. Ask me anything spanning six months of observed moves, pricing changes, and hiring signals. My current reference anchor date is ${demoClockDate}.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const [inputQuestion, setInputQuestion] = useState('');
  const [selectedCompetitorId, setSelectedCompetitorId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [expandedMemoryId, setExpandedMemoryId] = useState<string | null>(null);

  const suggestedQuestions = [
    'How has NovaFlow’s strategy changed over the last six months?',
    'Has NovaFlow repeatedly reduced prices?',
    'What changed after NovaFlow’s AI product launch?',
    'What are the three biggest strategic changes we observed?',
    'Compare NovaFlow and OrbitStack’s product direction.',
    'What engineering roles did NovaFlow hire before launching OmniAgent?',
  ];

  const handleSend = async (questionText?: string) => {
    const q = (questionText || inputQuestion).trim();
    if (!q || isLoading) return;

    const userMsg: MessageHistoryItem = {
      id: 'msg-' + Math.random().toString(36).substring(2, 9),
      sender: 'user',
      text: q,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuestion('');
    setIsLoading(true);

    try {
      const resp = await onAskQuestion(
        q,
        selectedCompetitorId || undefined,
        conversationId || undefined
      );

      setConversationId(resp.conversationId);

      const agentMsg: MessageHistoryItem = {
        id: 'msg-' + Math.random().toString(36).substring(2, 9),
        sender: 'agent',
        text: resp.answer.summary,
        response: resp.answer,
        mode: resp.mode,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, agentMsg]);
    } catch (err: any) {
      const errorMsg: MessageHistoryItem = {
        id: 'msg-err-' + Math.random().toString(36).substring(2, 9),
        sender: 'agent',
        text: `Error processing query: ${err.message}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Header */}
      <div className="border-b border-slate-800 pb-4">
        <div className="flex items-center gap-2">
          <MessageSquareText className="w-5 h-5 text-emerald-400" />
          <h2 className="text-lg font-bold text-white tracking-tight">Ask Across Time</h2>
          <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800">
            Hindsight Memory Powered
          </span>
        </div>
        <p className="text-xs text-slate-400 mt-1">
          Inquire across multi-month event sequences. CompetitorLens correlates disparate price cuts, hiring precursors, and feature announcements with strict evidence grounding.
        </p>
      </div>

      {/* Suggested Questions Pills */}
      <div className="space-y-1.5">
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
          Suggested Strategic Inquiries
        </span>
        <div className="flex flex-wrap gap-2">
          {suggestedQuestions.map((q, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(q)}
              disabled={isLoading}
              className="text-xs px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-300 hover:text-white transition disabled:opacity-50 text-left"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Chat Messages Log */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 sm:p-6 min-h-[460px] flex flex-col justify-between shadow-inner">
        <div className="space-y-6 overflow-y-auto max-h-[600px] pr-2">
          {messages.map((msg) => {
            const isUser = msg.sender === 'user';
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
              >
                {/* Header */}
                <div className="flex items-center gap-2 mb-1 text-[11px] text-slate-400 font-mono">
                  <span>{isUser ? 'You' : 'CompetitorLens'}</span>
                  <span>{msg.timestamp}</span>
                  {msg.mode && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-indigo-300">
                      {msg.mode.replace('_', ' ')}
                    </span>
                  )}
                </div>

                {/* Bubble */}
                <div
                  className={`rounded-xl p-4 max-w-3xl text-xs leading-relaxed ${
                    isUser
                      ? 'bg-indigo-600 text-white font-medium shadow-md shadow-indigo-600/20'
                      : 'bg-slate-900 border border-slate-800 text-slate-200 shadow-md space-y-4'
                  }`}
                >
                  {isUser ? (
                    <div>{msg.text}</div>
                  ) : msg.response ? (
                    /* Exact Answer Presentation Structure (Section 10) */
                    <div className="space-y-4">
                      {/* Summary */}
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 block mb-1">
                          Summary
                        </span>
                        <p className="text-sm font-semibold text-white leading-normal">
                          {msg.response.summary}
                        </p>
                      </div>

                      {/* Observed Changes (Dated Facts) */}
                      {msg.response.observedChanges.length > 0 && (
                        <div className="space-y-1.5 pt-2 border-t border-slate-800">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                            Observed Changes (Chronological Verified Facts)
                          </span>
                          <div className="space-y-2">
                            {msg.response.observedChanges.map((ch, idx) => (
                              <div
                                key={idx}
                                className="p-2.5 rounded bg-slate-950/70 border border-slate-800/80 flex items-start justify-between gap-3"
                              >
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono text-[10px] text-indigo-300 font-semibold">
                                      {ch.date}
                                    </span>
                                    <span className="font-bold text-white text-xs">{ch.title}</span>
                                  </div>
                                  <p className="text-slate-300 text-[11px] mt-0.5">{ch.description}</p>
                                </div>
                                {ch.evidenceIds && ch.evidenceIds[0] && (
                                  <button
                                    onClick={() => onOpenEvidence(ch.evidenceIds[0])}
                                    className="shrink-0 text-[10px] text-indigo-400 hover:text-indigo-300 underline font-mono flex items-center gap-1"
                                  >
                                    <FileText className="w-3 h-3" />
                                    <span>Cite</span>
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Historical Pattern */}
                      {msg.response.historicalPattern && (
                        <div className="p-3 bg-indigo-950/30 border border-indigo-800/60 rounded-lg">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300 block mb-1">
                            Historical Pattern Across Time
                          </span>
                          <p className="text-slate-200 text-xs leading-relaxed">
                            {msg.response.historicalPattern}
                          </p>
                        </div>
                      )}

                      {/* Business Significance */}
                      {msg.response.businessSignificance && (
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                            Business Significance
                          </span>
                          <p className="text-slate-300 text-xs leading-relaxed bg-slate-950 p-2.5 rounded border border-slate-800">
                            {msg.response.businessSignificance}
                          </p>
                        </div>
                      )}

                      {/* Recommended Next Steps */}
                      {msg.response.recommendedNextSteps.length > 0 && (
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block mb-1">
                            Recommended Next Steps
                          </span>
                          <ul className="list-disc list-inside space-y-1 text-slate-300 text-xs">
                            {msg.response.recommendedNextSteps.map((step, idx) => (
                              <li key={idx}>{step}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Uncertainty & Coverage */}
                      <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400 space-y-1">
                        <span className="font-semibold text-slate-300 block">Uncertainty & Coverage:</span>
                        <p>{msg.response.uncertaintyAndCoverage}</p>
                      </div>

                      {/* Expandable Memory Context Used */}
                      {msg.response.memoryContextUsed.length > 0 && (
                        <div className="pt-2 border-t border-slate-800">
                          <button
                            onClick={() =>
                              setExpandedMemoryId(expandedMemoryId === msg.id ? null : msg.id)
                            }
                            className="flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 font-semibold"
                          >
                            <Brain className="w-3.5 h-3.5" />
                            <span>
                              {expandedMemoryId === msg.id ? 'Hide' : 'View'} Persistent Memory Context Used (
                              {msg.response.memoryContextUsed.length} memories)
                            </span>
                            {expandedMemoryId === msg.id ? (
                              <ChevronUp className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5" />
                            )}
                          </button>

                          {expandedMemoryId === msg.id && (
                            <div className="mt-2 space-y-2 bg-slate-950 p-3 rounded-lg border border-purple-900/60 animate-in fade-in">
                              {msg.response.memoryContextUsed.map((mem) => (
                                <div key={mem.memoryId} className="text-[11px] space-y-0.5 border-b border-slate-800 pb-1.5 last:border-0">
                                  <div className="flex items-center justify-between text-slate-400 font-mono">
                                    <span className="text-purple-300">{mem.competitor}</span>
                                    <span>{mem.date}</span>
                                  </div>
                                  <p className="text-slate-300">{mem.summary}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>{msg.text}</div>
                  )}
                </div>
              </div>
            );
          })}

          {isLoading && (
            <div className="flex items-center gap-2 text-xs text-indigo-400 font-mono animate-pulse">
              <Brain className="w-4 h-4 animate-spin" />
              <span>Querying Hindsight persistent memory bank and synthesizing historical dossier...</span>
            </div>
          )}
        </div>

        {/* Question Input */}
        <div className="mt-4 pt-3 border-t border-slate-800 flex flex-col sm:flex-row items-center gap-2">
          {/* Competitor context anchor */}
          <select
            value={selectedCompetitorId}
            onChange={(e) => setSelectedCompetitorId(e.target.value)}
            className="w-full sm:w-44 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200"
          >
            <option value="">All Competitors</option>
            {competitors.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <div className="relative flex-1 w-full">
            <input
              type="text"
              placeholder="Ask across six months of history (e.g. How has NovaFlow's strategy changed?)..."
              value={inputQuestion}
              onChange={(e) => setInputQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSend();
              }}
              disabled={isLoading}
              className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <button
            onClick={() => handleSend()}
            disabled={isLoading || !inputQuestion.trim()}
            className="w-full sm:w-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition shadow"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Ask</span>
          </button>
        </div>
      </div>
    </div>
  );
};
