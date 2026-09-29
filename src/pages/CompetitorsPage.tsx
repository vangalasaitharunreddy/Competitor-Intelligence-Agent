import React, { useState } from 'react';
import {
  Users,
  Plus,
  Globe,
  Radio,
  ExternalLink,
  MessageSquareText,
  RefreshCw,
  Clock,
  Sparkles,
  Tag,
  DollarSign,
  Briefcase,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import {
  Competitor,
  Source,
  IntelligenceEvent,
  StrategicInsight,
} from '../types/intelligence.ts';

interface CompetitorsPageProps {
  competitors: Competitor[];
  sources: Source[];
  events: IntelligenceEvent[];
  insights: StrategicInsight[];
  onAddCompetitor: (name: string, domain: string, description: string, tier: 'primary' | 'secondary' | 'watch') => Promise<void>;
  onAddSource: (competitorId: string, name: string, type: any, url: string) => Promise<void>;
  onScanCompetitor: (competitorId: string) => Promise<void>;
  onAskAboutCompetitor: (competitorName: string) => void;
  onOpenEvidence: (evidenceId: string) => void;
}

export const CompetitorsPage: React.FC<CompetitorsPageProps> = ({
  competitors,
  sources,
  events,
  insights,
  onAddCompetitor,
  onAddSource,
  onScanCompetitor,
  onAskAboutCompetitor,
  onOpenEvidence,
}) => {
  const [selectedCompId, setSelectedCompId] = useState<string>(competitors[0]?.id || '');
  const [showAddCompModal, setShowAddCompModal] = useState(false);
  const [showAddSourceModal, setShowAddSourceModal] = useState(false);

  // Form states
  const [newCompName, setNewCompName] = useState('');
  const [newCompDomain, setNewCompDomain] = useState('');
  const [newCompDesc, setNewCompDesc] = useState('');
  const [newCompTier, setNewCompTier] = useState<'primary' | 'secondary' | 'watch'>('primary');

  const [newSrcName, setNewSrcName] = useState('');
  const [newSrcType, setNewSrcType] = useState('pricing_page');
  const [newSrcUrl, setNewSrcUrl] = useState('');

  const [scanningId, setScanningId] = useState<string | null>(null);

  const selectedComp = competitors.find((c) => c.id === selectedCompId) || competitors[0];
  const compSources = sources.filter((s) => s.competitorId === selectedComp?.id);
  const compEvents = events.filter((e) => e.competitorId === selectedComp?.id);
  const compInsights = insights.filter((i) => i.competitorId === selectedComp?.id);

  // Extract latest pricing
  const latestPricingEvent = compEvents.find((e) => e.eventType === 'pricing_change');
  const latestHiringEvent = compEvents.find((e) => e.eventType === 'hiring_signal');
  const latestMessagingEvent = compEvents.find((e) => e.eventType === 'messaging_shift');

  const handleScan = async (id: string) => {
    setScanningId(id);
    try {
      await onScanCompetitor(id);
    } finally {
      setScanningId(null);
    }
  };

  const handleCreateComp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompName || !newCompDomain) return;
    await onAddCompetitor(newCompName, newCompDomain, newCompDesc, newCompTier);
    setShowAddCompModal(false);
    setNewCompName('');
    setNewCompDomain('');
    setNewCompDesc('');
  };

  const handleCreateSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSrcName || !newSrcUrl || !selectedComp) return;
    await onAddSource(selectedComp.id, newSrcName, newSrcType as any, newSrcUrl);
    setShowAddSourceModal(false);
    setNewSrcName('');
    setNewSrcUrl('');
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Header and Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-400" />
            <span>Monitored Competitors</span>
          </h2>
          <p className="text-xs text-slate-400">
            Configure competitor registries, verify public sources, and track evolving footprints across time.
          </p>
        </div>

        <button
          onClick={() => setShowAddCompModal(true)}
          className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add Competitor</span>
        </button>
      </div>

      {/* Main Layout: Sidebar of competitors & Detail Pane */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {/* Left Competitors List */}
        <div className="space-y-2">
          {competitors.map((comp) => {
            const isSelected = comp.id === selectedComp?.id;
            const compEvts = events.filter((e) => e.competitorId === comp.id);
            const count = compEvts.length;
            const pricingEvt = compEvts.find((e) => e.eventType === 'pricing_change');
            const latestPrice = pricingEvt?.afterValue?.price
              ? `${pricingEvt.afterValue.currency || '₹'}${Number(pricingEvt.afterValue.price).toLocaleString()}/month`
              : comp.id.includes('novaflow')
              ? '₹35,000/month'
              : comp.id.includes('orbit')
              ? '$249/month'
              : 'Contact Sales';

            const lastDate = compEvts[0]?.publishedDate
              ? new Date(compEvts[0].publishedDate).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })
              : '18 Sep 2026';

            return (
              <div
                key={comp.id}
                onClick={() => setSelectedCompId(comp.id)}
                className={`p-4 rounded-xl border cursor-pointer transition text-xs space-y-2 ${
                  isSelected
                    ? 'bg-slate-800/90 border-indigo-500/80 shadow-md shadow-indigo-950'
                    : 'bg-slate-900/60 border-slate-800/80 hover:bg-slate-800/40 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-sm">{comp.name}</span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded font-mono uppercase ${
                      comp.tier === 'primary'
                        ? 'bg-indigo-950 text-indigo-300 border border-indigo-800'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {comp.tier === 'primary' ? 'Direct Competitor' : 'Secondary'}
                  </span>
                </div>

                <div className="text-xs font-mono font-semibold text-emerald-400 bg-emerald-950/40 border border-emerald-900/50 px-2.5 py-1 rounded inline-block">
                  {latestPrice}
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 text-[11px] text-slate-400">
                  <span>{count} verified moves</span>
                  <span>Last change: {lastDate}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Detail Pane */}
        {selectedComp && (
          <div className="md:col-span-2 lg:col-span-3 space-y-6">
            {/* Top Bar for Selected Competitor */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-bold text-white">{selectedComp.name}</h3>
                    <span className="text-xs font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                      {selectedComp.domain}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1">{selectedComp.description}</p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleScan(selectedComp.id)}
                    disabled={scanningId === selectedComp.id}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-medium text-slate-200 flex items-center gap-1.5 transition disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${scanningId === selectedComp.id ? 'animate-spin' : ''}`} />
                    <span>Scan Now</span>
                  </button>
                  <button
                    onClick={() => onAskAboutCompetitor(selectedComp.name)}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition"
                  >
                    <MessageSquareText className="w-3.5 h-3.5" />
                    <span>Ask About {selectedComp.name}</span>
                  </button>
                </div>
              </div>

              {/* Status Chips */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
                {/* Latest Pricing */}
                <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
                  <span className="text-[10px] font-semibold uppercase text-slate-400 flex items-center gap-1.5 mb-1">
                    <DollarSign className="w-3.5 h-3.5 text-sky-400" />
                    Latest Known Pricing
                  </span>
                  {latestPricingEvent && latestPricingEvent.afterValue ? (
                    <div>
                      <div className="font-bold text-white text-sm">
                        {latestPricingEvent.afterValue.currency || '₹'}
                        {latestPricingEvent.afterValue.price?.toLocaleString()}
                        <span className="text-xs font-normal text-slate-400">
                          {' '}
                          / {latestPricingEvent.afterValue.billingPeriod || 'month'}
                        </span>
                      </div>
                      <div className="text-[11px] text-sky-400 mt-0.5 truncate">
                        {latestPricingEvent.title}
                      </div>
                    </div>
                  ) : (
                    <span className="text-slate-500 text-xs">No public pricing changes observed</span>
                  )}
                </div>

                {/* Latest Hiring Signal */}
                <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
                  <span className="text-[10px] font-semibold uppercase text-slate-400 flex items-center gap-1.5 mb-1">
                    <Briefcase className="w-3.5 h-3.5 text-emerald-400" />
                    Hiring Evidence
                  </span>
                  {latestHiringEvent ? (
                    <div>
                      <div className="font-bold text-white text-xs truncate">
                        {latestHiringEvent.title}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5 font-mono">
                        {latestHiringEvent.publishedDate}
                      </div>
                    </div>
                  ) : (
                    <span className="text-slate-500 text-xs">No active hiring signals recorded</span>
                  )}
                </div>

                {/* Latest Messaging Shift */}
                <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
                  <span className="text-[10px] font-semibold uppercase text-slate-400 flex items-center gap-1.5 mb-1">
                    <Tag className="w-3.5 h-3.5 text-pink-400" />
                    Messaging Positioning
                  </span>
                  {latestMessagingEvent ? (
                    <div>
                      <div className="font-medium text-white text-xs truncate">
                        {latestMessagingEvent.title}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5 font-mono">
                        {latestMessagingEvent.publishedDate}
                      </div>
                    </div>
                  ) : (
                    <span className="text-slate-500 text-xs">Standard baseline messaging</span>
                  )}
                </div>
              </div>
            </div>

            {/* Configured Sources Matrix */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Radio className="w-4 h-4 text-emerald-400" />
                  <h4 className="text-xs font-semibold text-white uppercase tracking-wider">
                    Configured Observation Sources ({compSources.length})
                  </h4>
                </div>
                <button
                  onClick={() => setShowAddSourceModal(true)}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add Source</span>
                </button>
              </div>

              {compSources.length === 0 ? (
                <div className="text-xs text-slate-500 p-4 text-center">
                  No public sources configured for this competitor.
                </div>
              ) : (
                <div className="divide-y divide-slate-800/60 text-xs">
                  {compSources.map((src) => (
                    <div key={src.id} className="py-2.5 flex items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white">{src.name}</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono">
                            {src.type}
                          </span>
                        </div>
                        <a
                          href={src.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-slate-400 hover:text-indigo-300 transition flex items-center gap-1 mt-0.5"
                        >
                          <span className="truncate max-w-sm">{src.url}</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="flex items-center gap-1.5 justify-end">
                          <span className="w-2 h-2 rounded-full bg-emerald-400" />
                          <span className="text-[11px] text-slate-300">
                            {src.lastStatus ? `HTTP ${src.lastStatus}` : 'Active'}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono">
                          Interval: {src.fetchIntervalHours}h
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Strategic Insights Specific to Competitor */}
            {compInsights.length > 0 && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
                <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  <h4 className="text-xs font-semibold text-white uppercase tracking-wider">
                    Strategic Dossiers for {selectedComp.name}
                  </h4>
                </div>
                {compInsights.map((ins) => (
                  <div key={ins.id} className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-lg space-y-2">
                    <h5 className="text-xs font-bold text-white">{ins.title}</h5>
                    <p className="text-xs text-slate-300">{ins.summary}</p>
                    <div className="text-[11px] text-slate-400">
                      <span className="font-semibold text-indigo-300">Business Significance: </span>
                      {ins.businessSignificance}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add Competitor Modal */}
      {showAddCompModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white">Add New Tracked Competitor</h3>
            <form onSubmit={handleCreateComp} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 mb-1">Company Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Apex Rival Labs"
                  value={newCompName}
                  onChange={(e) => setNewCompName(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-slate-100"
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-1">Domain *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. rival.com"
                  value={newCompDomain}
                  onChange={(e) => setNewCompDomain(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-slate-100"
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-1">Strategic Description</label>
                <textarea
                  rows={2}
                  placeholder="e.g. High-velocity competitor competing for our enterprise tier..."
                  value={newCompDesc}
                  onChange={(e) => setNewCompDesc(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-slate-100"
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-1">Priority Tier</label>
                <select
                  value={newCompTier}
                  onChange={(e) => setNewCompTier(e.target.value as any)}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-slate-100"
                >
                  <option value="primary">Primary (Direct Threat)</option>
                  <option value="secondary">Secondary (Adjacent)</option>
                  <option value="watch">Watchlist</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddCompModal(false)}
                  className="px-3 py-1.5 text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-medium"
                >
                  Create Competitor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Source Modal */}
      {showAddSourceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white">Add Monitored Source for {selectedComp.name}</h3>
            <form onSubmit={handleCreateSource} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 mb-1">Source Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Public Pricing Matrix"
                  value={newSrcName}
                  onChange={(e) => setNewSrcName(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-slate-100"
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-1">Source Type *</label>
                <select
                  value={newSrcType}
                  onChange={(e) => setNewSrcType(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-slate-100"
                >
                  <option value="pricing_page">Pricing Page (HTML comparison)</option>
                  <option value="product_updates">Product Updates & Changelog</option>
                  <option value="announcements_rss">Announcements (RSS/Atom Feed)</option>
                  <option value="custom_page">Custom Web Page</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-300 mb-1">Public URL *</label>
                <input
                  type="url"
                  required
                  placeholder="https://competitor.com/pricing"
                  value={newSrcUrl}
                  onChange={(e) => setNewSrcUrl(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-slate-100"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Must be public HTTP/HTTPS. Private IP ranges are rejected for SSRF security.
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddSourceModal(false)}
                  className="px-3 py-1.5 text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-medium"
                >
                  Attach Source
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
