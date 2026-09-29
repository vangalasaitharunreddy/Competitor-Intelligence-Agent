import React, { useState } from 'react';
import {
  Clock,
  Filter,
  Search,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  DollarSign,
  Rocket,
  Briefcase,
  Megaphone,
  Handshake,
  FileText,
} from 'lucide-react';
import {
  IntelligenceEvent,
  Competitor,
  EventType,
} from '../types/intelligence.ts';

interface TimelinePageProps {
  events: IntelligenceEvent[];
  competitors: Competitor[];
  onOpenEvidence: (evidenceId: string) => void;
  onSelectEventForComparison: (eventId: string) => void;
}

export const TimelinePage: React.FC<TimelinePageProps> = ({
  events,
  competitors,
  onOpenEvidence,
  onSelectEventForComparison,
}) => {
  const [selectedCompId, setSelectedCompId] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

  // Filtering
  const filteredEvents = events.filter((ev) => {
    if (selectedCompId !== 'all' && ev.competitorId !== selectedCompId) return false;
    if (selectedType !== 'all' && ev.eventType !== selectedType) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match =
        ev.title.toLowerCase().includes(q) ||
        ev.description.toLowerCase().includes(q) ||
        (ev.competitorName && ev.competitorName.toLowerCase().includes(q));
      if (!match) return false;
    }
    const evDate = ev.publishedDate || ev.firstObservedAt.slice(0, 10);
    if (startDate && evDate < startDate) return false;
    if (endDate && evDate > endDate) return false;
    return true;
  });

  const getEventIcon = (type: EventType) => {
    switch (type) {
      case 'pricing_change':
        return <DollarSign className="w-4 h-4 text-sky-400" />;
      case 'feature_launch':
        return <Rocket className="w-4 h-4 text-indigo-400" />;
      case 'hiring_signal':
        return <Briefcase className="w-4 h-4 text-emerald-400" />;
      case 'partnership':
        return <Handshake className="w-4 h-4 text-amber-400" />;
      case 'company_announcement':
      case 'messaging_shift':
      default:
        return <Megaphone className="w-4 h-4 text-purple-400" />;
    }
  };

  const formatDateShort = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300 max-w-4xl mx-auto">
      {/* Header with Filter Toggle */}
      <div className="border-b border-slate-800 pb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-400" />
            <span>Timeline</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Chronological feed of verified competitor moves across time.
          </p>
        </div>

        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition ${
            showFilters || selectedCompId !== 'all' || selectedType !== 'all'
              ? 'bg-indigo-950/80 border-indigo-700 text-indigo-300'
              : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
          }`}
        >
          <Filter className="w-3.5 h-3.5" />
          <span>Filters</span>
          {(selectedCompId !== 'all' || selectedType !== 'all' || searchQuery) && (
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
          )}
        </button>
      </div>

      {/* Filter Bar (Collapsible) */}
      {showFilters && (
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-sm space-y-3 text-xs animate-in fade-in duration-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {/* Competitor filter */}
            <div>
              <label className="block text-slate-400 mb-1">Competitor</label>
              <select
                value={selectedCompId}
                onChange={(e) => setSelectedCompId(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-200"
              >
                <option value="all">All Competitors</option>
                {competitors.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Event type filter */}
            <div>
              <label className="block text-slate-400 mb-1">Category</label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-200"
              >
                <option value="all">All Categories</option>
                <option value="pricing_change">Pricing Changes</option>
                <option value="feature_launch">Feature Launches</option>
                <option value="hiring_signal">Hiring Signals</option>
                <option value="partnership">Partnerships</option>
                <option value="messaging_shift">Messaging Shifts</option>
                <option value="company_announcement">Company Announcements</option>
              </select>
            </div>

            {/* Date range */}
            <div>
              <label className="block text-slate-400 mb-1">From Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-200"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">To Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-200"
              />
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search in title, description, or evidence..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500"
            />
          </div>
        </div>
      )}

      {/* Events Clean Feed */}
      <div className="space-y-3">
        {filteredEvents.length === 0 ? (
          <div className="p-12 text-center bg-slate-900/60 border border-slate-800 rounded-2xl text-slate-400 text-xs">
            No events match your current filter parameters.
          </div>
        ) : (
          filteredEvents.map((ev) => {
            const dateStr = ev.publishedDate || ev.firstObservedAt.slice(0, 10);
            const shortDate = formatDateShort(dateStr);
            const isExpanded = expandedEventId === ev.id;

            return (
              <div
                key={ev.id}
                className="bg-slate-900/80 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 transition-all duration-200 space-y-3"
              >
                {/* Clean 4-row layout as specified */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    {/* Date Pill */}
                    <div className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-xs font-mono font-bold text-slate-200 shrink-0 text-center min-w-[58px]">
                      {shortDate}
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-sm">
                          {ev.competitorName || 'Competitor'}
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded uppercase font-semibold bg-indigo-950/80 text-indigo-300 border border-indigo-800/80">
                          {ev.eventType.replace('_', ' ')}
                        </span>
                      </div>

                      <h4 className="text-sm font-semibold text-slate-100">
                        {ev.title}
                      </h4>
                    </div>
                  </div>

                  <button
                    onClick={() => setExpandedEventId(isExpanded ? null : ev.id)}
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-medium shrink-0 pt-1"
                  >
                    {isExpanded ? 'Less' : 'Details'}
                  </button>
                </div>

                {/* Structured pricing change preview if available */}
                {ev.beforeValue && ev.afterValue && (
                  <div className="ml-14 bg-slate-950/60 border border-slate-800/80 px-3 py-1.5 rounded-lg text-xs font-mono text-slate-200 inline-flex items-center gap-2">
                    <span className="text-slate-400">{ev.beforeValue.currency}{ev.beforeValue.price?.toLocaleString()}</span>
                    <ArrowRight className="w-3 h-3 text-slate-500" />
                    <span className="font-bold text-emerald-400">{ev.afterValue.currency}{ev.afterValue.price?.toLocaleString()}</span>
                    {ev.afterValue.changePercentage !== undefined && (
                      <span className={`text-[10px] font-bold ${ev.afterValue.changePercentage < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                        ({ev.afterValue.changePercentage}%)
                      </span>
                    )}
                  </div>
                )}

                {/* Expanded Details Section */}
                {isExpanded && (
                  <div className="ml-14 pt-3 border-t border-slate-800/80 space-y-3 text-xs animate-in fade-in duration-200">
                    <p className="text-slate-300 leading-relaxed bg-slate-950/40 p-3 rounded-xl border border-slate-800">
                      {ev.description}
                    </p>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <div className="flex items-center gap-2">
                        {ev.evidenceIds.map((id) => (
                          <button
                            key={id}
                            onClick={() => onOpenEvidence(id)}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-indigo-300 rounded border border-slate-700 text-[11px] font-mono flex items-center gap-1 transition"
                          >
                            <ShieldCheck className="w-3 h-3 text-emerald-400" />
                            <span>Evidence #{id.slice(-6)}</span>
                          </button>
                        ))}
                      </div>

                      <button
                        onClick={() => onSelectEventForComparison(ev.id)}
                        className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1 font-medium"
                      >
                        <span>Compare Memory Impact →</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
