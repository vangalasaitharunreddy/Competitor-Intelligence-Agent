import React, { useState, useEffect } from 'react';
import {
  Brain,
  CheckCircle2,
  Clock,
  RefreshCw,
  Search,
  Tag,
  FileText,
  AlertCircle,
  Database,
  ExternalLink,
} from 'lucide-react';
import { MemoryItemView, MemoryOutboxItem } from '../types/intelligence.ts';

interface MemoryExplorerPageProps {
  onOpenEvidence: (evidenceId: string) => void;
}

export const MemoryExplorerPage: React.FC<MemoryExplorerPageProps> = ({ onOpenEvidence }) => {
  const [memoryItems, setMemoryItems] = useState<MemoryItemView[]>([]);
  const [outboxQueue, setOutboxQueue] = useState<MemoryOutboxItem[]>([]);
  const [bankId, setBankId] = useState('');
  const [hindsightConfigured, setHindsightConfigured] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');

  const fetchStatus = async () => {
    setIsLoading(true);
    try {
      const resp = await fetch('/api/memory/status');
      const data = await resp.json();
      setMemoryItems(data.items || []);
      setOutboxQueue(data.outboxQueue || []);
      setBankId(data.bankId || '');
      setHindsightConfigured(data.hindsightConfigured || false);
    } catch (err) {
      console.error('Failed fetching memory status:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const filteredItems = memoryItems.filter((item) => {
    if (filterType !== 'all' && item.recordType !== filterType) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        item.contentSnippet.toLowerCase().includes(q) ||
        item.competitor.toLowerCase().includes(q) ||
        item.documentId.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Header */}
      <div className="border-b border-slate-800 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-purple-400" />
            <h2 className="text-lg font-bold text-white tracking-tight">Hindsight Persistent Memory Explorer</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Inspection ledger of persistent memory banks, retained observations, ingestion states, and outbox delivery logs.
          </p>
        </div>

        <button
          onClick={fetchStatus}
          disabled={isLoading}
          className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg text-xs font-medium text-slate-300 flex items-center gap-1.5 transition self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh Bank</span>
        </button>
      </div>

      {/* Connection & Bank Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
            Target Hindsight Bank
          </span>
          <div className="text-sm font-bold text-purple-300 font-mono mt-1 truncate">
            {bankId || 'bank_live_workspace'}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            {hindsightConfigured ? 'Connected to Vectorize API' : 'Local Preview Storage Simulation'}
          </span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
            Total Retained Documents
          </span>
          <div className="text-2xl font-bold text-white mt-1">{memoryItems.length}</div>
          <span className="text-[11px] text-emerald-400 mt-0.5 block flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            <span>Ready for historical recall</span>
          </span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
            Outbox Queue Backlog
          </span>
          <div className="text-2xl font-bold text-slate-300 mt-1">{outboxQueue.length}</div>
          <span className="text-[11px] text-slate-500 mt-0.5 block">
            Pending asynchronous delivery
          </span>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search document IDs, competitor names, or memory contents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-slate-200"
          />
        </div>

        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="w-full sm:w-48 px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-slate-200"
        >
          <option value="all">All Record Types</option>
          <option value="verified_observation">Verified Observation</option>
          <option value="accepted_correction">Accepted Correction</option>
          <option value="user_preference">User Preference</option>
          <option value="analyst_hypothesis">Analyst Hypothesis</option>
        </select>
      </div>

      {/* Memory Items Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">
            Persistent Bank Memories ({filteredItems.length})
          </h3>
          <span className="text-[11px] text-slate-400 font-mono">
            Deterministic IDs prevent overwrite
          </span>
        </div>

        {filteredItems.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            No memories match the filter. Load the demo dataset or run a scan to seed memory.
          </div>
        ) : (
          <div className="divide-y divide-slate-800 text-xs">
            {filteredItems.map((item) => (
              <div key={item.id} className="p-4 hover:bg-slate-850 transition space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-purple-300 font-semibold text-[11px]">
                      {item.documentId}
                    </span>
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                      {item.recordType.replace('_', ' ')}
                    </span>
                    <span className="font-bold text-white text-xs">{item.competitor}</span>
                  </div>

                  <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                    <span className="text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                      {item.status.toUpperCase()}
                    </span>
                    <span>{new Date(item.ingestedAt).toLocaleString()}</span>
                  </div>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed font-sans">{item.contentSnippet}</p>

                {item.evidenceIds && item.evidenceIds.length > 0 && (
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-[10px] text-slate-500">Citations:</span>
                    {item.evidenceIds.map((evId) => (
                      <button
                        key={evId}
                        onClick={() => onOpenEvidence(evId)}
                        className="text-[10px] text-indigo-400 hover:text-indigo-300 underline font-mono flex items-center gap-0.5"
                      >
                        <FileText className="w-2.5 h-2.5" />
                        <span>#{evId.replace('evi-', '')}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Outbox Backlog Drawer */}
      {outboxQueue.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
            <Clock className="w-4 h-4 text-amber-400" />
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              Pending Outbox Queue Items ({outboxQueue.length})
            </h4>
          </div>
          <div className="space-y-2 text-xs">
            {outboxQueue.map((item) => (
              <div key={item.id} className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="font-mono text-[11px] text-slate-300">{item.eventType}</span>
                  <p className="text-[10px] text-slate-500 mt-0.5">Entity: {item.entityId}</p>
                </div>
                <div className="text-right font-mono text-[10px]">
                  <span className="text-amber-400">{item.status}</span>
                  <span className="text-slate-500 block">Retries: {item.retryCount}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
