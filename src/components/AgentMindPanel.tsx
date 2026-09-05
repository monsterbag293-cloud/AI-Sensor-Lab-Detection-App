import React, { useRef, useEffect, useState } from 'react';
import {
  Brain,
  Compass,
  Moon,
  Sun,
  Sparkles,
  AlertTriangle,
  Zap,
  Sliders,
  Eye,
  Trash2,
  Footprints,
  Activity,
  MessageSquare,
  Send,
  User,
  Bot,
  Target,
  Copy,
  Check
} from 'lucide-react';
import {
  AIMindState,
  AgentPose,
  CompactAgentMemory,
  MindTimelineEvent,
  MindIntention,
  HumanAdvisorMessage
} from '../types';

interface AgentMindPanelProps {
  mindState: AIMindState;
  pose: AgentPose;
  memory: CompactAgentMemory;
  timeline: MindTimelineEvent[];
  thinkingInterval: number; // in seconds
  onThinkingIntervalChange: (val: number) => void;
  onWakeNow: () => void;
  onClearTimeline: () => void;
  onSendMessageToAI: (text: string) => void;
}

export const AgentMindPanel: React.FC<AgentMindPanelProps> = ({
  mindState,
  pose,
  memory,
  timeline,
  thinkingInterval,
  onThinkingIntervalChange,
  onWakeNow,
  onClearTimeline,
  onSendMessageToAI,
}) => {
  const [activeTab, setActiveTab] = useState<'mind' | 'chat'>('mind');
  const [chatInput, setChatInput] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const timelineEndRef = useRef<HTMLDivElement | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const handleCopyText = (key: string, text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey((prev) => (prev === key ? null : prev));
    }, 2000);
  };

  const getFullAIResponseText = () => {
    const parts = [];
    if (mindState.currentObservation) parts.push(`[OBSERVATION]\n${mindState.currentObservation}`);
    if (mindState.thoughtSummary) parts.push(`[DECISION RATIONALE]\n${mindState.thoughtSummary}`);
    if (mindState.currentAction) parts.push(`[CHOSEN ACTION]\n${mindState.currentAction} (${mindState.intention})`);
    if (mindState.explorationGoal) parts.push(`[EXPLORATION GOAL]\n${mindState.explorationGoal}`);
    if (mindState.responseToHuman) parts.push(`[RESPONSE TO HUMAN]\n${mindState.responseToHuman}`);
    return parts.join('\n\n');
  };

  useEffect(() => {
    timelineEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [timeline]);

  useEffect(() => {
    if (activeTab === 'chat') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [mindState.advisorMessages, activeTab]);

  const handleSendChat = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!chatInput.trim()) return;
    onSendMessageToAI(chatInput.trim());
    setChatInput('');
  };

  const handleQuickPill = (text: string) => {
    onSendMessageToAI(text);
  };

  // Color mapping for intentions
  const getIntentionBadgeClass = (intention: MindIntention) => {
    switch (intention) {
      case 'Investigate':
        return 'bg-amber-950/70 text-amber-300 border-amber-600/70';
      case 'Explore':
        return 'bg-emerald-950/70 text-emerald-300 border-emerald-600/70';
      case 'Approach':
        return 'bg-teal-950/70 text-teal-300 border-teal-600/70';
      case 'Leave':
        return 'bg-rose-950/70 text-rose-300 border-rose-600/70';
      case 'Stay':
        return 'bg-indigo-950/70 text-indigo-300 border-indigo-600/70';
      case 'Observe':
        return 'bg-cyan-950/70 text-cyan-300 border-cyan-600/70';
      case 'Grasp':
        return 'bg-purple-950/70 text-purple-300 border-purple-600/70';
      case 'Manipulate':
        return 'bg-blue-950/70 text-blue-300 border-blue-600/70';
      case 'Test_Force':
        return 'bg-rose-950/70 text-rose-300 border-rose-600/70';
      case 'Inspect':
        return 'bg-amber-950/70 text-amber-300 border-amber-600/70';
      default:
        return 'bg-neutral-800 text-neutral-300 border-neutral-700';
    }
  };

  const isAwake = mindState.status === 'AWAKE';
  const sleepProgressPercent = Math.max(
    0,
    Math.min(
      100,
      ((thinkingInterval - mindState.timeUntilNextWake) / (thinkingInterval || 1)) * 100
    )
  );

  return (
    <aside className="w-full lg:w-[390px] bg-[#0f0f10] border-l border-[#222] flex flex-col h-full text-[#e0e0e0] font-mono text-xs select-none overflow-hidden">
      {/* 1. Header & Prominent AWAKE / SLEEPING Status */}
      <div className="p-3 border-b border-[#222] bg-[#111]">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-emerald-400 font-bold uppercase tracking-wider text-xs">
            <Brain className="w-4 h-4 text-emerald-400" />
            <span>AI MIND (COGNITIVE REASONING)</span>
          </div>
          <span className="text-[9px] font-mono text-[#666] uppercase tracking-widest">
            CYCLE #{mindState.wakeCycleCount}
          </span>
        </div>

        {/* State Banner */}
        <div
          className={`p-2.5 rounded border transition-all ${
            isAwake
              ? 'bg-emerald-950/50 border-emerald-500/80 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
              : mindState.isRateLimited
              ? 'bg-amber-950/40 border-amber-500/60 text-amber-300'
              : 'bg-[#141418] border-[#333] text-[#aaa]'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isAwake ? (
                <div className="relative flex items-center justify-center">
                  <Sun className="w-4 h-4 text-emerald-400 animate-spin" />
                  <span className="absolute w-2 h-2 rounded-full bg-emerald-400 animate-ping opacity-75" />
                </div>
              ) : mindState.isRateLimited ? (
                <AlertTriangle className="w-4 h-4 text-amber-400 animate-pulse" />
              ) : (
                <Moon className="w-4 h-4 text-indigo-400" />
              )}
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold uppercase tracking-widest">
                    STATUS:{' '}
                    {mindState.status === 'WAITING_FOR_USER'
                      ? 'WAITING FOR USER'
                      : isAwake
                      ? mindState.awakePhase === 'ACTING'
                        ? `AWAKE (ACTING ${mindState.currentStepInCycle || 1}/${mindState.maxStepsInCycle || 4})`
                        : `AWAKE (THINKING ${mindState.currentStepInCycle || 1})`
                      : mindState.isRateLimited
                      ? 'QUOTA COOLDOWN'
                      : 'SLEEPING (RESTING)'}
                  </span>
                  {mindState.activeModel && (
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-900/60 text-emerald-300 border border-emerald-700/50 font-mono">
                      {mindState.activeModel}
                    </span>
                  )}
                </div>
                <span className="block text-[10px] text-[#888] font-sans truncate max-w-[210px]">
                  {mindState.status === 'WAITING_FOR_USER'
                    ? 'Turn finished. Awaiting user input or Wake trigger.'
                    : isAwake
                    ? mindState.awakePhase === 'ACTING'
                      ? `Acting: ${mindState.currentAction}`
                      : 'Sampling sensory receptors & formulating decision...'
                    : mindState.isRateLimited
                    ? `Quota recharge (${mindState.timeUntilNextWake.toFixed(0)}s remaining)`
                    : `Next wake in ${mindState.timeUntilNextWake.toFixed(1)}s (interval: ${thinkingInterval}s)`}
                </span>
              </div>
            </div>

            {/* Prominent WAKE AI Button */}
            {(!isAwake || mindState.status === 'WAITING_FOR_USER') && (
              <button
                onClick={onWakeNow}
                disabled={mindState.isRateLimited && mindState.timeUntilNextWake > 0}
                className={`px-3 py-1.5 rounded border text-[10px] font-bold uppercase tracking-widest transition-all cursor-pointer flex items-center gap-1.5 shadow-md ${
                  mindState.status === 'WAITING_FOR_USER'
                    ? 'bg-amber-600 hover:bg-amber-500 border-amber-400 text-white shadow-[0_0_12px_rgba(245,158,11,0.3)] animate-pulse'
                    : mindState.isRateLimited && mindState.timeUntilNextWake > 0
                    ? 'bg-[#18181b] border-[#2e2e32] text-[#555] cursor-not-allowed'
                    : 'bg-[#1e1e24] hover:bg-emerald-800 hover:text-white border-[#3a3a44] text-emerald-300'
                }`}
                title={
                  mindState.isRateLimited && mindState.timeUntilNextWake > 0
                    ? `Quota cooldown active (${mindState.timeUntilNextWake.toFixed(0)}s remaining)`
                    : 'Awaken AI mind immediately'
                }
              >
                <Zap className={`w-3.5 h-3.5 ${mindState.status === 'WAITING_FOR_USER' ? 'text-white' : 'text-amber-400'}`} />
                <span>WAKE AI</span>
              </button>
            )}
          </div>

          {/* Active Goal Display during Awakening */}
          {isAwake && mindState.explorationGoal && (
            <div className="mt-2 pt-1.5 border-t border-emerald-800/40 text-[10px] flex items-center gap-1.5 text-emerald-200">
              <Target className="w-3 h-3 text-emerald-400 shrink-0" />
              <span className="font-sans truncate">
                <strong className="font-mono text-emerald-400 text-[9px] mr-1">ACTIVE GOAL:</strong>
                {mindState.explorationGoal}
              </span>
            </div>
          )}

          {/* Sleep / Cooldown Countdown Progress Bar */}
          {!isAwake && (
            <div className="mt-2 w-full bg-[#0a0a0b] h-1.5 rounded-full overflow-hidden border border-[#222]">
              <div
                className={`h-full transition-all duration-300 ${
                  mindState.isRateLimited
                    ? 'bg-gradient-to-r from-amber-600 to-amber-400'
                    : 'bg-gradient-to-r from-indigo-500 to-emerald-400'
                }`}
                style={{ width: `${sleepProgressPercent}%` }}
              />
            </div>
          )}
        </div>

        {/* Navigation Tabs: Mind Telemetry vs Advisor Chat */}
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#222]">
          <div className="flex items-center gap-1 bg-[#0a0a0b] p-0.5 rounded-md border border-[#222]">
            <button
              onClick={() => setActiveTab('mind')}
              className={`px-3 py-1 rounded text-[10px] font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'mind'
                  ? 'bg-[#222] text-emerald-400 border border-[#333]'
                  : 'text-[#777] hover:text-[#bbb]'
              }`}
            >
              <Brain className="w-3 h-3" />
              <span>Cognitive State</span>
            </button>
            <button
              onClick={() => setActiveTab('chat')}
              className={`px-3 py-1 rounded text-[10px] font-medium transition-colors flex items-center gap-1.5 relative cursor-pointer ${
                activeTab === 'chat'
                  ? 'bg-[#222] text-amber-300 border border-[#333]'
                  : 'text-[#777] hover:text-[#bbb]'
              }`}
            >
              <MessageSquare className="w-3 h-3" />
              <span>Advisor Chat</span>
              {mindState.advisorMessages && mindState.advisorMessages.length > 0 && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              )}
            </button>
          </div>

          {/* Thinking Interval Configuration Controls */}
          <div className="flex items-center gap-1">
            <span className="text-[9px] text-[#666] hidden sm:inline">Interval:</span>
            {[10, 15, 20, 30].map((sec) => (
              <button
                key={sec}
                onClick={() => onThinkingIntervalChange(sec)}
                className={`px-1.5 py-0.5 rounded text-[8px] font-mono transition-colors cursor-pointer border ${
                  thinkingInterval === sec
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-600 font-bold'
                    : 'bg-[#18181b] text-[#777] hover:text-[#bbb] border-[#2e2e32]'
                }`}
              >
                {sec}s
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 2. TAB CONTENT */}
      {activeTab === 'chat' ? (
        /* ADVISOR CHAT VIEW */
        <div className="flex-1 flex flex-col overflow-hidden bg-[#0c0c0e]">
          {/* Chat Messages List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5 custom-scrollbar">
            <div className="bg-[#141418] p-2 rounded-lg border border-[#222] text-[10px] text-[#888] font-sans leading-relaxed">
              <span className="font-bold text-amber-400 block mb-0.5">🧠 Human Guidance Channel:</span>
              Provide hints, tell the AI about what it is looking at, warn it about changes you made in the sandbox, or suggest physical hypotheses. The AI receives your guidance in each conscious wake cycle!
            </div>

            {(!mindState.advisorMessages || mindState.advisorMessages.length === 0) ? (
              <div className="text-center py-6 text-[#555] text-[10px] italic">
                No advice sent yet. Type a message below or tap a quick prompt.
              </div>
            ) : (
              mindState.advisorMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${
                    msg.sender === 'human' ? 'items-end' : 'items-start'
                  }`}
                >
                  <div className="flex items-center justify-between w-full text-[8px] text-[#666] mb-0.5 px-1">
                    <div className="flex items-center gap-1">
                      {msg.sender === 'human' ? (
                        <>
                          <span>Human Observer</span>
                          <User className="w-2.5 h-2.5 text-amber-400" />
                        </>
                      ) : (
                        <>
                          <Bot className="w-2.5 h-2.5 text-emerald-400" />
                          <span className="text-emerald-400">AI Mind</span>
                        </>
                      )}
                      <span>• {msg.timestamp}</span>
                    </div>
                    <button
                      onClick={() => handleCopyText(`msg-${msg.id}`, msg.text)}
                      className="p-0.5 text-[#666] hover:text-amber-300 transition-colors cursor-pointer flex items-center gap-1"
                      title="Copy message text"
                    >
                      {copiedKey === `msg-${msg.id}` ? (
                        <>
                          <Check className="w-2.5 h-2.5 text-emerald-400" />
                          <span className="text-[8px] text-emerald-400 font-bold">Copied</span>
                        </>
                      ) : (
                        <Copy className="w-2.5 h-2.5" />
                      )}
                    </button>
                  </div>
                  <div
                    className={`p-2.5 rounded-lg text-[11px] font-sans leading-snug max-w-[85%] break-words ${
                      msg.sender === 'human'
                        ? 'bg-amber-950/40 text-amber-200 border border-amber-700/50 rounded-tr-none'
                        : 'bg-[#18181c] text-[#ddd] border border-[#2e2e34] rounded-tl-none'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Quick Suggestion Pills */}
          <div className="p-2 border-t border-[#1e1e22] bg-[#111114]">
            <div className="text-[8px] text-[#666] uppercase tracking-wider mb-1">Quick Advice:</div>
            <div className="flex items-center gap-1 overflow-x-auto pb-1 custom-scrollbar">
              {[
                '⚠️ I just moved an object!',
                '💥 Squeeze the red block hard!',
                '👀 Turn around 180°',
                '🧊 The white monolith is rigid',
                '🔬 Inspect held object closely',
              ].map((pill, idx) => (
                <button
                  key={idx}
                  onClick={() => handleQuickPill(pill)}
                  className="shrink-0 px-2 py-1 rounded bg-[#18181d] hover:bg-[#222] border border-[#2a2a30] text-[9px] text-[#aaa] hover:text-amber-300 font-sans transition-colors cursor-pointer"
                >
                  {pill}
                </button>
              ))}
            </div>
          </div>

          {/* Chat Input Form */}
          <form onSubmit={handleSendChat} className="p-2.5 bg-[#141418] border-t border-[#222] flex items-center gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Give advice or info about what it is seeing..."
              className="flex-1 bg-[#0a0a0c] border border-[#2e2e34] rounded-lg px-2.5 py-1.5 text-white font-sans text-xs focus:outline-none focus:border-amber-500 placeholder:text-[#555]"
            />
            <button
              type="submit"
              disabled={!chatInput.trim()}
              className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-black font-semibold text-xs transition-all flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send</span>
            </button>
          </form>
        </div>
      ) : (
        /* COGNITIVE TELEMETRY VIEW */
        <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
          {/* Quick Action: Copy Full AI Mind State Response */}
          <button
            onClick={() => handleCopyText('full-response', getFullAIResponseText())}
            className="w-full py-1.5 px-2.5 rounded bg-[#18181d] hover:bg-[#22222a] border border-[#2e2e38] hover:border-amber-500/50 text-[#ccc] hover:text-amber-300 text-[10px] font-sans font-medium transition-all flex items-center justify-between cursor-pointer group shadow-xs"
          >
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400 group-hover:scale-110 transition-transform" />
              <span>Copy Full AI Response & Cognition</span>
            </span>
            {copiedKey === 'full-response' ? (
              <span className="flex items-center gap-1 text-emerald-400 font-bold text-[9px]">
                <Check className="w-3 h-3" />
                <span>Copied!</span>
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[#888] group-hover:text-amber-300 text-[9px]">
                <Copy className="w-3 h-3" />
                <span>Copy Text</span>
              </span>
            )}
          </button>

          {/* Intention & Current Action Cards */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-[#141416] p-2 rounded border border-[#26262b]">
              <span className="block text-[9px] text-[#666] mb-1 uppercase tracking-wider">INTENTION</span>
              <span
                className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${getIntentionBadgeClass(
                  mindState.intention
                )}`}
              >
                {mindState.intention}
              </span>
            </div>

            <div className="bg-[#141416] p-2 rounded border border-[#26262b]">
              <span className="block text-[9px] text-[#666] mb-1 uppercase tracking-wider">CHOSEN ACTION</span>
              <span className="text-emerald-400 font-bold text-[11px] block truncate">
                {mindState.currentAction || 'STAY'}
              </span>
            </div>
          </div>

          {/* Coordinates & Kinematics */}
          <div className="bg-[#141416] p-2 rounded border border-[#26262b] text-[10px] flex items-center justify-between">
            <span className="text-[#666] uppercase tracking-wider flex items-center gap-1">
              <Compass className="w-3 h-3 text-blue-400" />
              <span>Pose (XYZ / Yaw):</span>
            </span>
            <span className="text-blue-400 font-semibold font-mono">
              ({pose.x.toFixed(2)}, {pose.y.toFixed(2)}, {pose.z.toFixed(2)}) | {pose.yaw.toFixed(1)}°
            </span>
          </div>

          {/* AI Response to Human Chat if present */}
          {mindState.responseToHuman && (
            <div className="bg-amber-950/30 p-2.5 rounded border border-amber-600/50">
              <div className="text-[9px] font-bold text-amber-400 uppercase tracking-wider mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <MessageSquare className="w-3 h-3 text-amber-400" />
                  <span>AI RESPONSE TO HUMAN ADVISOR</span>
                </span>
                <button
                  onClick={() => handleCopyText('ai-response-human', mindState.responseToHuman || '')}
                  className="text-[#888] hover:text-amber-300 transition cursor-pointer p-0.5 flex items-center gap-1"
                  title="Copy AI response"
                >
                  {copiedKey === 'ai-response-human' ? (
                    <span className="text-emerald-400 text-[8px] font-bold flex items-center gap-0.5">
                      <Check className="w-2.5 h-2.5" />
                      Copied
                    </span>
                  ) : (
                    <Copy className="w-2.5 h-2.5" />
                  )}
                </button>
              </div>
              <p className="text-[11px] leading-relaxed text-amber-200 font-sans select-text">
                "{mindState.responseToHuman}"
              </p>
            </div>
          )}

          {/* Current Observation (Natural language interpretation without color words) */}
          <div className="bg-[#141416] p-2.5 rounded border border-[#26262b]">
            <div className="text-[9px] font-bold text-[#888] uppercase tracking-wider mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Eye className="w-3 h-3 text-cyan-400" />
                <span>CURRENT OBSERVATION</span>
              </span>
              <button
                onClick={() =>
                  handleCopyText(
                    'obs',
                    mindState.currentObservation ||
                      'Continuous retinal integration: photoreceptors sensing chamber radiance.'
                  )
                }
                className="text-[#666] hover:text-amber-300 transition cursor-pointer p-0.5 flex items-center gap-1"
                title="Copy observation text"
              >
                {copiedKey === 'obs' ? (
                  <span className="text-emerald-400 text-[8px] font-bold flex items-center gap-0.5">
                    <Check className="w-2.5 h-2.5" />
                    Copied
                  </span>
                ) : (
                  <Copy className="w-2.5 h-2.5" />
                )}
              </button>
            </div>
            <p className="text-[11px] leading-relaxed text-[#ccc] font-sans select-text">
              {mindState.currentObservation ||
                'Continuous retinal integration: photoreceptors sensing chamber radiance.'}
            </p>
          </div>

          {/* Current Thought Summary (Decision rationale) */}
          <div className="bg-[#141416] p-2.5 rounded border border-[#26262b] border-l-2 border-l-emerald-500">
            <div className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-emerald-400" />
                <span>DECISION RATIONALE</span>
              </span>
              <button
                onClick={() =>
                  handleCopyText(
                    'thought',
                    mindState.thoughtSummary ||
                      'Sensory channels are steady; awaiting scheduled conscious wake cycle.'
                  )
                }
                className="text-[#666] hover:text-amber-300 transition cursor-pointer p-0.5 flex items-center gap-1"
                title="Copy rationale text"
              >
                {copiedKey === 'thought' ? (
                  <span className="text-emerald-400 text-[8px] font-bold flex items-center gap-0.5">
                    <Check className="w-2.5 h-2.5" />
                    Copied
                  </span>
                ) : (
                  <Copy className="w-2.5 h-2.5" />
                )}
              </button>
            </div>
            <p className="text-[11px] leading-relaxed text-[#bbb] italic font-sans select-text">
              "{mindState.thoughtSummary ||
                'Sensory channels are steady; awaiting scheduled conscious wake cycle.'}"
            </p>
            <div className="mt-1.5 flex items-center justify-between text-[9px] text-[#666]">
              <span>Estimated Curiosity / Interest:</span>
              <span className="text-emerald-400 font-bold">
                {Math.round(mindState.estimatedInterest * 100)}%
              </span>
            </div>
          </div>

          {/* Anti-Loop Warning Badge if active */}
          {memory.suppressedActionNotice && (
            <div className="p-2 rounded bg-amber-950/40 border border-amber-600/60 text-amber-300 text-[10px] flex items-start gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold uppercase tracking-wide block">ANTI-LOOP ACTIVE:</span>
                <span className="text-[9px] font-sans text-amber-200/90 leading-tight">
                  {memory.suppressedActionNotice}
                </span>
              </div>
            </div>
          )}

          {/* Persistent Memory Stats */}
          <div className="bg-[#141416] p-2.5 rounded border border-[#26262b]">
            <div className="text-[9px] font-bold text-[#888] uppercase tracking-wider mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Footprints className="w-3 h-3 text-indigo-400" />
                <span>PERSISTENT MEMORY</span>
              </span>
              <span className="text-[9px] text-emerald-500/70">
                {memory.exploredGrid.length} GRID REGIONS VISITED
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div className="bg-[#0a0a0b] p-1.5 rounded border border-[#222]">
                <span className="text-[#666] block text-[8px] uppercase">Investigated Features</span>
                <span className="text-emerald-400 font-bold">
                  {memory.encounteredFeatures.length} targets logged
                </span>
              </div>
              <div className="bg-[#0a0a0b] p-1.5 rounded border border-[#222]">
                <span className="text-[#666] block text-[8px] uppercase">Stationary Cycles</span>
                <span className="text-indigo-300 font-bold">
                  {memory.consecutiveStationaryCount} cycles
                </span>
              </div>
            </div>

            {/* Discovered Mechanical Consequences */}
            {memory.discoveredConsequences && memory.discoveredConsequences.length > 0 && (
              <div className="mt-2.5 pt-2 border-t border-[#222] space-y-1.5">
                <span className="text-[8px] uppercase tracking-wider text-amber-400 font-bold block flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5" />
                  Physical Properties Discovered:
                </span>
                {memory.discoveredConsequences.slice(-3).map((c) => (
                  <div
                    key={c.id}
                    className="bg-[#0c0c0f] p-1.5 rounded border border-amber-900/40 text-[9px]"
                  >
                    <div className="flex items-center justify-between text-[#777] text-[8px]">
                      <span className="text-amber-400 font-bold">[{c.actionUsed}]</span>
                      <span>Cycle #{c.cycleLearned}</span>
                    </div>
                    <div className="text-amber-200 font-medium">{c.discoveredProperty}</div>
                    <div className="text-[#888] text-[8px] truncate">{c.sensoryOutcome}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Wake-Sleep Cycle Timeline Section */}
          <div className="bg-[#111] p-2.5 rounded border border-[#26262b] flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[9px] font-bold uppercase tracking-wider text-[#888] flex items-center gap-1">
                <Activity className="w-3 h-3 text-emerald-400" />
                <span>WAKE-SLEEP TIMELINE ({timeline.length})</span>
              </span>
              <button
                onClick={onClearTimeline}
                className="p-1 rounded text-[#555] hover:text-rose-400 hover:bg-[#1a1a1c] transition cursor-pointer"
                title="Clear Timeline History"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>

            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
              {timeline.length === 0 ? (
                <div className="text-[#444] text-center py-4 italic text-[10px]">
                  No cycle events logged yet.
                </div>
              ) : (
                timeline.map((evt) => {
                  let badgeClass = 'text-[#888] bg-[#1a1a1c] border-[#333]';
                  if (evt.stage === 'WOKE') badgeClass = 'text-amber-400 bg-amber-950/40 border-amber-800';
                  if (evt.stage === 'OBSERVED') badgeClass = 'text-cyan-400 bg-cyan-950/40 border-cyan-800';
                  if (evt.stage === 'DECISION') badgeClass = 'text-emerald-400 bg-emerald-950/40 border-emerald-800';
                  if (evt.stage === 'ACTION') badgeClass = 'text-blue-400 bg-blue-950/40 border-blue-800';
                  if (evt.stage === 'SLEEPING') badgeClass = 'text-indigo-400 bg-indigo-950/40 border-indigo-800';
                  if (evt.stage === 'ANTI_LOOP') badgeClass = 'text-rose-400 bg-rose-950/40 border-rose-800';
                  if (evt.stage === 'RATE_LIMIT') badgeClass = 'text-amber-400 bg-amber-950/40 border-amber-800';

                  return (
                    <div
                      key={evt.id}
                      className="p-1 rounded bg-[#0a0a0b] border border-[#222] text-[9px] font-mono"
                    >
                      <div className="flex items-center justify-between text-[8px] text-[#555] mb-0.5">
                        <span className={`px-1 rounded border font-bold ${badgeClass}`}>
                          [{evt.timestamp}] {evt.stage}
                        </span>
                      </div>
                      <div className="text-[#bbb] font-sans leading-tight pl-0.5 break-words">
                        {evt.summary}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={timelineEndRef} />
            </div>
          </div>
        </div>
      )}

      {/* Footer: Spectral Lighting Profile (400-700nm) */}
      <footer className="p-2 bg-[#0a0a0b] border-t border-[#222]">
        <div className="text-[8px] text-[#555] text-center mb-1 uppercase tracking-widest font-mono">
          SPECTRAL POWER RECEPTIVE BAND (400–700 NM)
        </div>
        <div className="h-3.5 w-full bg-gradient-to-r from-blue-700 via-cyan-400 via-green-400 via-yellow-300 to-red-600 rounded-xs opacity-50 border border-[#222]" />
      </footer>
    </aside>
  );
};
