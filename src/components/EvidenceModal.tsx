import React, { useState } from 'react';
import { X, ExternalLink, ShieldCheck, AlertCircle, FileText, CheckCircle2 } from 'lucide-react';
import { Evidence } from '../types/intelligence.ts';

interface EvidenceModalProps {
  evidence: Evidence | null;
  onClose: () => void;
  onSubmitCorrection: (evidenceId: string, notes: string, proposedCorrection: string) => Promise<void>;
}

export const EvidenceModal: React.FC<EvidenceModalProps> = ({
  evidence,
  onClose,
  onSubmitCorrection,
}) => {
  if (!evidence) return null;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCorrectionForm, setShowCorrectionForm] = useState(false);
  const [correctionNote, setCorrectionNote] = useState('');
  const [proposedText, setProposedText] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleCorrect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!correctionNote.trim()) return;

    setIsSubmitting(true);
    try {
      await onSubmitCorrection(evidence.id, correctionNote, proposedText);
      setSuccessMsg('Factual correction accepted and queued for memory update.');
      setTimeout(() => {
        onClose();
      }, 1800);
    } catch (err: any) {
      alert(`Error submitting correction: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl max-w-2xl w-full p-6 text-slate-100 relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-3">
          <FileText className="w-5 h-5 text-indigo-400" />
          <h3 className="text-base font-semibold text-white">Source Evidence Record</h3>
          <span
            className={`text-xs px-2 py-0.5 rounded font-mono font-medium ${
              evidence.provenance === 'synthetic'
                ? 'bg-amber-950 text-amber-300 border border-amber-800'
                : evidence.provenance === 'imported'
                ? 'bg-blue-950 text-blue-300 border border-blue-800'
                : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
            }`}
          >
            {evidence.provenance.toUpperCase()}
          </span>
        </div>

        <div className="space-y-4 text-xs">
          {/* Metadata Card */}
          <div className="grid grid-cols-2 gap-3 bg-slate-800/60 p-3 rounded-lg border border-slate-700/60">
            <div>
              <span className="text-slate-400 block">Source Title</span>
              <span className="font-medium text-slate-200">{evidence.sourceTitle}</span>
            </div>
            <div>
              <span className="text-slate-400 block">Observed Timestamp</span>
              <span className="font-mono text-slate-300">{new Date(evidence.observedAt).toLocaleString()}</span>
            </div>
            <div className="col-span-2">
              <span className="text-slate-400 block">Source URL</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="font-mono text-indigo-300 truncate">{evidence.sourceUrl}</span>
                <a
                  href={evidence.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-slate-400 hover:text-indigo-300 transition"
                  title="Open source URL"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>

          {/* Passage Content */}
          <div>
            <span className="text-slate-400 block mb-1 font-semibold uppercase tracking-wider text-[10px]">
              Extracted Raw Passage / Snapshot Excerpt
            </span>
            <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-serif leading-relaxed text-sm whitespace-pre-wrap">
              {evidence.passageText}
            </div>
          </div>

          {/* Dispute Warning if any */}
          {evidence.isDisputed && (
            <div className="p-3 bg-rose-950/60 border border-rose-800/80 rounded-lg text-rose-200 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block">Record Disputed / Flagged</span>
                <span className="text-xs text-rose-300">{evidence.disputeReason || 'Disputed by intelligence analyst.'}</span>
              </div>
            </div>
          )}

          {/* Success Message */}
          {successMsg && (
            <div className="p-3 bg-emerald-950/70 border border-emerald-700 rounded-lg text-emerald-200 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Correction Section */}
          {!showCorrectionForm ? (
            <div className="pt-2 flex justify-between items-center border-t border-slate-800">
              <div className="flex items-center gap-1.5 text-slate-400 text-xs">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Verified against canonical evidence hash.</span>
              </div>
              <button
                type="button"
                onClick={() => setShowCorrectionForm(true)}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-medium underline"
              >
                Challenge or Correct Fact
              </button>
            </div>
          ) : (
            <form onSubmit={handleCorrect} className="space-y-3 pt-3 border-t border-slate-800">
              <h4 className="font-semibold text-white text-xs">Submit Factual Correction</h4>
              <p className="text-slate-400 text-[11px]">
                Accepting a correction will supersede the canonical event, invalidate dependent facts in Hindsight memory, and flag any affected insights as stale.
              </p>

              <div>
                <label className="block text-slate-300 mb-1 text-[11px]">Reason for Dispute / Error Details *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Plan terms changed or feature name was misidentified in release notes"
                  value={correctionNote}
                  onChange={(e) => setCorrectionNote(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-slate-100 text-xs focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 text-[11px]">Proposed Correct Value (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Actual enterprise price is ₹40,000 billed quarterly, not flat monthly"
                  value={proposedText}
                  onChange={(e) => setProposedText(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-slate-100 text-xs focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowCorrectionForm(false)}
                  className="px-3 py-1 text-slate-400 hover:text-slate-200 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded font-medium text-xs shadow disabled:opacity-50"
                >
                  {isSubmitting ? 'Updating Memory...' : 'Apply Correction & Update Memory'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
