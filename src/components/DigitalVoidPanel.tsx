import React, { useState } from 'react';
import {
  Activity,
  Radio,
  Clock,
  Sparkles,
  Eye,
  Brain,
  ShieldAlert,
  ChevronDown,
  ChevronRight,
  RotateCcw,
  Download,
  AlertTriangle,
  Compass,
  Zap,
  Volume2,
  Hand,
  Cpu,
  Layers,
  HelpCircle,
  BarChart2,
  List
} from 'lucide-react';
import {
  AIMindState,
  ArtificialVisionState,
  ArtificialAuditoryState,
  ArtificialTactileState,
  ProprioceptionState,
  DigitalVoidMetrics,
  DigitalVoidTimelineEvent
} from '../types';

interface DigitalVoidPanelProps {
  mindState: AIMindState;
  visionState: ArtificialVisionState | null;
  auditoryState: ArtificialAuditoryState | null;
  tactileState: ArtificialTactileState | null;
  proprioState: ProprioceptionState | null;
  metrics: DigitalVoidMetrics;
  timeline: DigitalVoidTimelineEvent[];
  rateLimitCooldownSeconds: number;
  onExitDigitalVoid: () => void;
  onExportLog: () => void;
}

export const DigitalVoidPanel: React.FC<DigitalVoidPanelProps> = ({
  mindState,
  visionState,
  auditoryState,
  tactileState,
  proprioState,
  metrics,
  timeline,
  rateLimitCooldownSeconds,
  onExitDigitalVoid,
  onExportLog,
}) => {
  const [showDiagnostics, setShowDiagnostics] = useState(true);
  const [showTimeline, setShowTimeline] = useState(true);

  // Format total seconds into HH:MM:SS
  const formatDuration = (sec: number) => {
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const secs = sec % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const isQuotaSleep = mindState.status === 'QUOTA_SLEEP' || rateLimitCooldownSeconds > 0;

  return (
    <div className="flex flex-col h-full bg-[#08080a] text-[#d4d4d8] font-mono select-none overflow-hidden border-l border-[#1f1f23]">
      {/* 1. Header Banner & Labeling */}
      <div className="bg-[#0f0f13] p-3 border-b border-[#1f1f23] space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="relative">
              <div className="w-3 h-3 rounded-full bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.8)] animate-pulse" />
              <div className="absolute inset-0 rounded-full bg-purple-400 animate-ping opacity-30" />
            </div>
            <div>
              <h2 className="text-xs font-bold tracking-[0.2em] text-purple-400 uppercase">
                DIGITAL VOID — AUTONOMOUS COGNITION EXPERIMENT
              </h2>
              <p className="text-[9px] text-[#71717a]">
                Controlled sensory isolation • Persistent Gemini cognition loop
              </p>
            </div>
          </div>
          <button
            onClick={onExitDigitalVoid}
            className="px-2.5 py-1 rounded bg-[#18181f] hover:bg-[#272730] border border-[#272730] hover:border-purple-500/50 text-[#e4e4e7] hover:text-purple-300 text-[10px] uppercase tracking-wider font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
          >
            <RotateCcw className="w-3 h-3 text-purple-400" />
            <span>EXIT DIGITAL VOID</span>
          </button>
        </div>

        {/* Experiment Operational Constraints Grid */}
        <div className="grid grid-cols-5 gap-1 text-[8px] uppercase tracking-wider font-bold">
          <div className="bg-[#121217] px-2 py-1 rounded border border-[#272730] text-rose-400 flex items-center gap-1">
            <ShieldAlert className="w-2.5 h-2.5" />
            <span>Human: DISCONNECTED</span>
          </div>
          <div className="bg-[#121217] px-2 py-1 rounded border border-[#272730] text-emerald-400 flex items-center gap-1">
            <Activity className="w-2.5 h-2.5" />
            <span>Hardware: 100% NOMINAL</span>
          </div>
          <div className="bg-[#121217] px-2 py-1 rounded border border-[#272730] text-indigo-400 flex items-center gap-1">
            <Radio className="w-2.5 h-2.5" />
            <span>Sensory: ISOLATION</span>
          </div>
          <div className="bg-[#121217] px-2 py-1 rounded border border-[#272730] text-amber-400 flex items-center gap-1">
            <Compass className="w-2.5 h-2.5" />
            <span>Epistemic: OPEN-ENDED</span>
          </div>
          <div className="bg-[#121217] px-2 py-1 rounded border border-[#272730] text-purple-400 flex items-center gap-1">
            <Hand className="w-2.5 h-2.5" />
            <span>Functions: DISABLED</span>
          </div>
        </div>
      </div>

      {/* Main Panel Content Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
        {/* Quota Backoff Alert Banner if active */}
        {isQuotaSleep && (
          <div className="bg-amber-950/40 border border-amber-600/60 p-2.5 rounded text-amber-200 text-[10px] space-y-1 animate-pulse">
            <div className="flex items-center gap-2 font-bold uppercase tracking-wider text-amber-400">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span>API QUOTA BACKOFF / RATE LIMIT COOLDOWN</span>
            </div>
            <p className="text-[9px] text-amber-300/80 leading-relaxed font-sans">
              API quota limit reached. Entering <strong>QUOTA SLEEP</strong>. All experiment state, cognitive memory, and sensory history are preserved. Auto-resuming cognition cycle in <strong>{rateLimitCooldownSeconds}s</strong>.
            </p>
          </div>
        )}

        {/* 2. LIVE AI ACTIVITY PANEL */}
        <div className="bg-[#0d0d12] border border-[#1f1f23] rounded p-3 space-y-2.5 shadow-sm">
          <div className="flex items-center justify-between border-b border-[#1f1f23] pb-1.5">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span className="text-xs font-bold text-purple-300 uppercase tracking-widest">
                LIVE AI ACTIVITY
              </span>
            </div>
            <div className="flex items-center gap-2 text-[9px]">
              <span className="flex items-center gap-1 bg-[#16161e] px-2 py-0.5 rounded border border-[#272730] text-purple-300">
                <Clock className="w-3 h-3 text-purple-400" />
                <span>{formatDuration(metrics.totalDurationSeconds)}</span>
              </span>
              <span className={`flex items-center gap-1 px-2 py-0.5 rounded font-bold uppercase border ${
                isQuotaSleep
                  ? 'bg-amber-950/60 text-amber-400 border-amber-600/50'
                  : 'bg-emerald-950/60 text-emerald-400 border-emerald-600/50'
              }`}>
                <Activity className="w-3 h-3 animate-pulse" />
                <span>{isQuotaSleep ? 'QUOTA_SLEEP' : mindState.status}</span>
              </span>
            </div>
          </div>

          {/* Primary State Metrics Grid */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-[#13131a] p-2 rounded border border-[#22222d]">
              <div className="text-[8px] text-[#71717a] uppercase font-bold tracking-wider mb-0.5">
                COGNITION CYCLE
              </div>
              <div className="text-lg font-bold text-purple-300 flex items-baseline gap-1">
                <span>#{metrics.cognitionCycles}</span>
                <span className="text-[9px] text-[#71717a] font-normal">cycles</span>
              </div>
            </div>

            <div className="bg-[#13131a] p-2 rounded border border-[#22222d]">
              <div className="text-[8px] text-[#71717a] uppercase font-bold tracking-wider mb-0.5">
                SPATIAL CONTEXT & FUNCTIONS
              </div>
              <div className="text-xs font-bold text-cyan-300 truncate">
                SOLITARY ISOLATION (Observational Experiment)
              </div>
            </div>
          </div>

          {/* Intention & Chosen Action Cards */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-[#13131a] p-2 rounded border border-[#22222d]">
              <div className="text-[8px] text-[#71717a] uppercase font-bold tracking-wider mb-0.5">
                CURRENT INTENTION
              </div>
              <div className="text-xs font-bold text-emerald-400">
                {mindState.intention || 'Observe'}
              </div>
            </div>

            <div className="bg-[#13131a] p-2 rounded border border-[#22222d]">
              <div className="text-[8px] text-[#71717a] uppercase font-bold tracking-wider mb-0.5">
                CURRENT ACTION
              </div>
              <div className="text-xs font-bold text-amber-400">
                {mindState.currentAction || 'stay'}
              </div>
            </div>
          </div>

          {/* Latest Observation Card */}
          <div className="bg-[#13131a] p-2.5 rounded border border-[#22222d] space-y-1">
            <div className="text-[9px] font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1">
              <Eye className="w-3 h-3 text-cyan-400" />
              <span>LATEST OBSERVATION SUMMARY</span>
            </div>
            <p className="text-[11px] leading-relaxed text-[#d4d4d8] font-sans select-text">
              {mindState.currentObservation || 'Sensory receptors measuring dark, silent digital void state.'}
            </p>
          </div>

          {/* Decision Rationale Card */}
          <div className="bg-[#13131a] p-2.5 rounded border border-[#22222d] border-l-2 border-l-purple-500 space-y-1">
            <div className="text-[9px] font-bold text-purple-400 uppercase tracking-wider flex items-center gap-1">
              <Brain className="w-3 h-3 text-purple-400" />
              <span>DECISION RATIONALE</span>
            </div>
            <p className="text-[11px] leading-relaxed text-[#a1a1aa] italic font-sans select-text">
              "{mindState.thoughtSummary || 'Integrating continuous sensory telemetry...'}"
            </p>
          </div>

          {/* Mental Computational Sandbox Terminal */}
          <div className="bg-[#050508] p-3 rounded border border-purple-900/40 space-y-2.5 relative overflow-hidden">
            <div className="absolute top-0 right-0 px-1.5 py-0.5 text-[7px] font-bold text-purple-400 bg-purple-950/40 border-l border-b border-purple-900/40 tracking-widest uppercase">
              Sandbox Active
            </div>
            <div className="text-[9px] font-bold text-purple-300 uppercase tracking-wider flex items-center gap-1.5 border-b border-purple-950 pb-1.5">
              <Cpu className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
              <span>MENTAL COMPUTATIONAL SANDBOX</span>
            </div>

            <div className="space-y-1.5">
              <div className="text-[7.5px] font-bold text-purple-400 uppercase tracking-wider">
                1. Mental Core Reflection
              </div>
              <div className="bg-[#0b0b10] border border-[#1d1d26] p-2 rounded text-[10px] text-zinc-300 font-sans select-text whitespace-pre-wrap max-h-36 overflow-y-auto custom-scrollbar leading-normal">
                {mindState.mentalComputationalScratchpad || 'No active reflections in mathematical core.'}
              </div>
            </div>

            {mindState.sandboxCodeToExecute && (
              <div className="space-y-1.5">
                <div className="text-[7.5px] font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-ping" />
                  <span>2. Core Script Submitted</span>
                </div>
                <pre className="bg-[#0b0b10] border border-[#171e2e] p-2 rounded text-[10px] text-cyan-300 font-mono select-text whitespace-pre overflow-x-auto max-h-36 custom-scrollbar">
                  <code>{mindState.sandboxCodeToExecute}</code>
                </pre>
              </div>
            )}

            {mindState.sandboxExecutionResult && (
              <div className="space-y-2">
                <div className="text-[7.5px] font-bold text-emerald-400 uppercase tracking-wider flex justify-between items-center">
                  <span>3. Sandbox Computation Result</span>
                  {typeof mindState.sandboxExecutionResult !== 'string' && (
                    <span className="text-[#a1a1aa] normal-case">
                      {mindState.sandboxExecutionResult.execution_time_ms} ms
                    </span>
                  )}
                </div>
                <div className="bg-[#040906] border border-[#14291c] p-2.5 rounded text-[10.5px] font-mono select-text space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
                  {typeof mindState.sandboxExecutionResult === 'string' ? (
                    <div className="text-emerald-400">{mindState.sandboxExecutionResult}</div>
                  ) : (
                    <>
                      <div className="flex justify-between border-b border-[#14291c]/50 pb-1 text-[9px] text-[#71717a]">
                        <span>STATUS: <span className={mindState.sandboxExecutionResult.success ? "text-emerald-400" : "text-red-400"}>{mindState.sandboxExecutionResult.success ? "SUCCESS" : "FAILURE"}</span></span>
                      </div>
                      {mindState.sandboxExecutionResult.stdout && (
                        <div>
                          <div className="text-[#71717a] text-[9px] mb-0.5">STDOUT:</div>
                          <div className="text-emerald-300 whitespace-pre-wrap">{mindState.sandboxExecutionResult.stdout}</div>
                        </div>
                      )}
                      {mindState.sandboxExecutionResult.stderr && (
                        <div>
                          <div className="text-red-400 text-[9px] mb-0.5">STDERR:</div>
                          <div className="text-red-400 whitespace-pre-wrap">{mindState.sandboxExecutionResult.stderr}</div>
                        </div>
                      )}
                      {mindState.sandboxExecutionResult.returned_value !== undefined && (
                        <div>
                          <div className="text-[#71717a] text-[9px] mb-0.5">RETURN VALUE:</div>
                          <div className="text-cyan-400 whitespace-pre-wrap">
                            {typeof mindState.sandboxExecutionResult.returned_value === 'object'
                              ? JSON.stringify(mindState.sandboxExecutionResult.returned_value, null, 2)
                              : String(mindState.sandboxExecutionResult.returned_value)}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Persistent Internal Artifacts Registry Card */}
          <div className="bg-[#0b0b10] p-3 rounded border border-purple-900/30 space-y-2.5 relative overflow-hidden">
            <div className="absolute top-0 right-0 px-1.5 py-0.5 text-[7px] font-bold text-purple-400 bg-purple-950/40 border-l border-b border-purple-900/40 tracking-widest uppercase">
              Durable Memory
            </div>
            <div className="text-[9px] font-bold text-purple-300 uppercase tracking-wider flex items-center gap-1.5 border-b border-purple-950 pb-1.5">
              <Compass className="w-3.5 h-3.5 text-purple-400" />
              <span>PERSISTENT INTERNAL ARTIFACTS REGISTRY</span>
            </div>

            {mindState.persistentArtifacts && mindState.persistentArtifacts.length > 0 ? (
              <div className="space-y-2.5 max-h-56 overflow-y-auto custom-scrollbar">
                {mindState.persistentArtifacts.map((art) => (
                  <div key={art.name} className="bg-[#101018] border border-[#1f1f2a] rounded p-2.5 space-y-1.5 animate-fadeIn">
                    <div className="flex justify-between items-center text-[10px] font-bold border-b border-zinc-800 pb-1">
                      <span className="text-purple-300 flex items-center gap-1">
                        <span>📁 {art.name}</span>
                      </span>
                      <span className="text-[#71717a] text-[8px]">
                        Created: #{art.creation_cycle} • Modified: #{art.last_modified_cycle}
                      </span>
                    </div>
                    <pre className="text-[10px] text-zinc-300 font-mono whitespace-pre-wrap leading-normal select-text">
                      {art.contents}
                    </pre>
                    {art.modifications && art.modifications.length > 1 && (
                      <div className="text-[8px] text-[#71717a] pt-1 flex gap-1.5 flex-wrap">
                        <span className="font-bold">HISTORY:</span>
                        {art.modifications.map((m, idx) => (
                          <span key={idx} className="bg-[#151522] border border-[#232335] px-1 rounded" title={m.reason}>
                            v{idx+1} (Cycle #{m.cycle})
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[10px] text-[#71717a] font-sans leading-relaxed italic">
                No internal artifacts registered yet. The agent can use the "artifact_to_create_or_modify" property to create persistent logs, notes, calculations, or models here.
              </p>
            )}
          </div>

          {/* Explicit Hypothesis Card if generated */}
          {mindState.unresolvedQuestions && (
            <div className="bg-[#13131a] p-2.5 rounded border border-[#22222d] space-y-1">
              <div className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                <HelpCircle className="w-3 h-3 text-emerald-400" />
                <span>SELF-GENERATED HYPOTHESIS / UNRESOLVED QUESTION</span>
              </div>
              <p className="text-[11px] leading-relaxed text-emerald-200 font-sans select-text">
                {mindState.unresolvedQuestions}
              </p>
            </div>
          )}

          {/* Behavioral Statistics Counters Grid */}
          <div className="pt-1 border-t border-[#1f1f23]">
            <div className="text-[9px] font-bold text-[#71717a] uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <BarChart2 className="w-3 h-3 text-purple-400" />
              <span>BEHAVIORAL MEASUREMENTS & TELEMETRY</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5 text-[9px]">
              <div className="bg-[#16161f] p-1.5 rounded border border-[#22222d]">
                <div className="text-[#71717a]">Head Rotations</div>
                <div className="font-bold text-purple-300 text-xs">{metrics.headRotationsCount}</div>
              </div>
              <div className="bg-[#16161f] p-1.5 rounded border border-[#22222d]">
                <div className="text-[#71717a]">Self-Questions</div>
                <div className="font-bold text-cyan-300 text-xs">{metrics.selfGeneratedQuestionsCount}</div>
              </div>
              <div className="bg-[#16161f] p-1.5 rounded border border-[#22222d]">
                <div className="text-[#71717a]">Hypotheses</div>
                <div className="font-bold text-emerald-300 text-xs">{metrics.selfGeneratedHypothesesCount}</div>
              </div>
              <div className="bg-[#16161f] p-1.5 rounded border border-[#22222d]">
                <div className="text-[#71717a]">Repeated States</div>
                <div className="font-bold text-amber-300 text-xs">{metrics.repeatedSensoryStateCount}</div>
              </div>
              <div className="bg-[#16161f] p-1.5 rounded border border-[#22222d]">
                <div className="text-[#71717a]">Uncertainty Refs</div>
                <div className="font-bold text-indigo-300 text-xs">{metrics.referencesToUncertaintyCount}</div>
              </div>
              <div className="bg-[#16161f] p-1.5 rounded border border-[#22222d]">
                <div className="text-[#71717a]">Quota Events</div>
                <div className="font-bold text-rose-300 text-xs">{metrics.quotaEventsCount}</div>
              </div>
            </div>
          </div>
        </div>

        {/* 3. RAW SENSOR DIAGNOSTICS (Collapsible) */}
        <div className="bg-[#0d0d12] border border-[#1f1f23] rounded shadow-sm">
          <button
            onClick={() => setShowDiagnostics(!showDiagnostics)}
            className="w-full p-2.5 flex items-center justify-between text-xs font-bold text-cyan-300 uppercase tracking-widest bg-[#121218] hover:bg-[#181822] cursor-pointer rounded-t"
          >
            <span className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-cyan-400" />
              <span>RAW SENSOR DIAGNOSTICS</span>
            </span>
            <span className="flex items-center gap-1 text-[9px] text-[#71717a]">
              {showDiagnostics ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </span>
          </button>

          {showDiagnostics && (
            <div className="p-3 space-y-2.5 border-t border-[#1f1f23]">
              {/* Explicit Sensor Status Banner */}
              <div className="bg-emerald-950/40 border border-emerald-600/50 p-2 rounded text-emerald-300 text-[9px] flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold">
                  <Zap className="w-3.5 h-3.5 text-emerald-400" />
                  <span>SENSOR STATUS: ONLINE — ZERO EXTERNAL STIMULUS</span>
                </div>
                <span className="text-[8px] bg-emerald-900/60 px-1.5 py-0.5 rounded text-emerald-200">
                  NO SENSOR FAILURE
                </span>
              </div>

              {/* Visual 7-Cone Spectral Telemetry */}
              <div className="space-y-1">
                <div className="text-[9px] font-bold text-[#71717a] uppercase flex items-center gap-1">
                  <Eye className="w-3 h-3 text-cyan-400" />
                  <span>128×128 Retina (16,384 Receptors, 7 Spectral Channels)</span>
                </div>
                <div className="grid grid-cols-4 gap-1 text-[8px]">
                  <div className="bg-[#14141c] p-1.5 rounded border border-[#22222d]">
                    <span className="text-[#71717a]">UV (350nm):</span>{' '}
                    <span className="text-purple-300 font-bold">{(visionIndex(visionState, 'uv') || 0.001).toFixed(4)}</span>
                  </div>
                  <div className="bg-[#14141c] p-1.5 rounded border border-[#22222d]">
                    <span className="text-[#71717a]">S (440nm):</span>{' '}
                    <span className="text-blue-300 font-bold">{(visionState?.coneTotals?.sTotal || 0.001).toFixed(4)}</span>
                  </div>
                  <div className="bg-[#14141c] p-1.5 rounded border border-[#22222d]">
                    <span className="text-[#71717a]">S2 (480nm):</span>{' '}
                    <span className="text-cyan-300 font-bold">{(visionIndex(visionState, 's2') || 0.001).toFixed(4)}</span>
                  </div>
                  <div className="bg-[#14141c] p-1.5 rounded border border-[#22222d]">
                    <span className="text-[#71717a]">M (540nm):</span>{' '}
                    <span className="text-emerald-300 font-bold">{(visionState?.coneTotals?.mTotal || 0.001).toFixed(4)}</span>
                  </div>
                  <div className="bg-[#14141c] p-1.5 rounded border border-[#22222d]">
                    <span className="text-[#71717a]">M2 (565nm):</span>{' '}
                    <span className="text-lime-300 font-bold">{(visionIndex(visionState, 'm2') || 0.001).toFixed(4)}</span>
                  </div>
                  <div className="bg-[#14141c] p-1.5 rounded border border-[#22222d]">
                    <span className="text-[#71717a]">L (600nm):</span>{' '}
                    <span className="text-amber-300 font-bold">{(visionState?.coneTotals?.lTotal || 0.001).toFixed(4)}</span>
                  </div>
                  <div className="bg-[#14141c] p-1.5 rounded border border-[#22222d]">
                    <span className="text-[#71717a]">NIR (850nm):</span>{' '}
                    <span className="text-rose-300 font-bold">{(visionIndex(visionState, 'nir') || 0.001).toFixed(4)}</span>
                  </div>
                  <div className="bg-[#14141c] p-1.5 rounded border border-[#22222d]">
                    <span className="text-[#71717a]">Thermal MWIR:</span>{' '}
                    <span className="text-red-300 font-bold">{(visionIndex(visionState, 'thermal') || 0.001).toFixed(4)}</span>
                  </div>
                </div>
              </div>

              {/* Auditory Diagnostics */}
              <div className="space-y-1">
                <div className="text-[9px] font-bold text-[#71717a] uppercase flex items-center gap-1">
                  <Volume2 className="w-3 h-3 text-indigo-400" />
                  <span>Cochlear ERB Filterbank & Binaural Cues</span>
                </div>
                <div className="grid grid-cols-3 gap-1 text-[8px]">
                  <div className="bg-[#14141c] p-1.5 rounded border border-[#22222d]">
                    <span className="text-[#71717a]">SPL Left:</span>{' '}
                    <span className="text-indigo-300 font-bold">30.0 dB SPL</span>
                  </div>
                  <div className="bg-[#14141c] p-1.5 rounded border border-[#22222d]">
                    <span className="text-[#71717a]">SPL Right:</span>{' '}
                    <span className="text-indigo-300 font-bold">30.0 dB SPL</span>
                  </div>
                  <div className="bg-[#14141c] p-1.5 rounded border border-[#22222d]">
                    <span className="text-[#71717a]">Binaural ITD:</span>{' '}
                    <span className="text-indigo-300 font-bold">0 µs</span>
                  </div>
                </div>
              </div>

              {/* Tactile Diagnostics (INACTIVE) */}
              <div className="space-y-1">
                <div className="text-[9px] font-bold text-[#71717a] uppercase flex items-center gap-1">
                  <Hand className="w-3 h-3 text-amber-400" />
                  <span>Virtual Skin Mechanoreceptors (INACTIVE IN VOID)</span>
                </div>
                <div className="grid grid-cols-2 gap-1 text-[8px]">
                  <div className="bg-[#14141c] p-1.5 rounded border border-[#22222d]">
                    <span className="text-[#71717a]">Normal Compression:</span>{' '}
                    <span className="text-amber-300 font-bold">0.00 N (Zero Contact)</span>
                  </div>
                  <div className="bg-[#14141c] p-1.5 rounded border border-[#22222d]">
                    <span className="text-[#71717a]">Indentation Deformation:</span>{' '}
                    <span className="text-amber-300 font-bold">0.00 mm</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 4. EXPERIMENT TIMELINE (Persistent Scrollable) */}
        <div className="bg-[#0d0d12] border border-[#1f1f23] rounded shadow-sm">
          <div className="p-2.5 flex items-center justify-between text-xs font-bold text-purple-300 uppercase tracking-widest bg-[#121218] rounded-t border-b border-[#1f1f23]">
            <span className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-purple-400" />
              <span>EXPERIMENT TIMELINE ({timeline.length} EVENTS)</span>
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={onExportLog}
                className="px-2 py-0.5 rounded bg-[#1f1f2b] hover:bg-[#2b2b3a] text-purple-300 text-[9px] font-bold flex items-center gap-1 border border-purple-500/30 cursor-pointer"
                title="Download full experiment timeline JSON"
              >
                <Download className="w-3 h-3 text-purple-400" />
                <span>EXPORT LOG</span>
              </button>
              <button
                onClick={() => setShowTimeline(!showTimeline)}
                className="text-[#71717a] hover:text-[#d4d4d8] cursor-pointer"
              >
                {showTimeline ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {showTimeline && (
            <div className="p-2 space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar">
              {timeline.length === 0 ? (
                <div className="text-[10px] text-[#71717a] text-center py-4 italic">
                  No timeline events recorded yet. Cognition loop active.
                </div>
              ) : (
                timeline.slice(-100).map((evt) => (
                  <div
                    key={evt.id}
                    className={`p-2 rounded border text-[10px] space-y-1 ${
                      evt.isQuotaEvent
                        ? 'bg-amber-950/30 border-amber-600/50 text-amber-200'
                        : evt.isRestart
                        ? 'bg-purple-950/30 border-purple-600/50 text-purple-200'
                        : 'bg-[#13131a] border-[#22222d] text-[#d4d4d8]'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[8px] font-bold tracking-wider text-[#71717a] border-b border-[#1f1f2a] pb-1">
                      <span className="text-purple-300">CYCLE #{evt.cycle}</span>
                      <span>{evt.timestamp}</span>
                    </div>
                    <div className="space-y-0.5 text-[9px]">
                      <div>
                        <strong className="text-cyan-400">SENSORY:</strong> {evt.sensoryStateSummary}
                      </div>
                      <div>
                        <strong className="text-amber-400">ACTION:</strong> {evt.action}
                      </div>
                      <div>
                        <strong className="text-emerald-400">OBSERVATION:</strong> {evt.resultingSensoryStateSummary}
                      </div>
                      <div>
                        <strong className="text-purple-300">RATIONALE:</strong> {evt.nextCognitionSummary}
                      </div>
                      {evt.hypothesis && (
                        <div className="text-emerald-300 italic">
                          <strong>HYPOTHESIS:</strong> "{evt.hypothesis}"
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Helper function to extract spectral indices safely
function visionIndex(visionState: ArtificialVisionState | null, key: string): number {
  if (!visionState || !visionState.coneTotals) return 0.001;
  const totals = visionState.coneTotals as any;
  if (key === 'uv') return totals.uvTotal || 0.001;
  if (key === 's2') return totals.s2Total || 0.001;
  if (key === 'm2') return totals.m2Total || 0.001;
  if (key === 'nir') return totals.nirTotal || 0.001;
  if (key === 'thermal') return totals.thermalTotal || 0.001;
  return 0.001;
}
