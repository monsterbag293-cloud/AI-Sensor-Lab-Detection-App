import React, { useState, useRef, useEffect } from 'react';
import {
  Brain,
  Compass,
  Terminal,
  Activity,
  Trash2,
  CheckCircle2,
  Clock,
  Sparkles,
  Sliders
} from 'lucide-react';
import { AgentPose, LogEntry, ToolCallPayload } from '../types';

interface AgentStatusPanelProps {
  pose: AgentPose;
  currentAction: string;
  lastThought: string;
  lastToolCall: ToolCallPayload | null;
  lastToolResult: string;
  logs: LogEntry[];
  isReasoning: boolean;
  onClearLogs: () => void;
}

export const AgentStatusPanel: React.FC<AgentStatusPanelProps> = ({
  pose,
  currentAction,
  lastThought,
  lastToolCall,
  lastToolResult,
  logs,
  isReasoning,
  onClearLogs,
}) => {
  const [activeFilter, setActiveFilter] = useState<string>('ALL');
  const logEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const filteredLogs = logs.filter((entry) => {
    if (activeFilter === 'ALL') return true;
    return entry.category === activeFilter;
  });

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'WORLD STATE':
        return 'text-blue-400 border-blue-900/60 bg-blue-950/30';
      case 'ARTIFICIAL EYE':
        return 'text-cyan-400 border-cyan-900/60 bg-cyan-950/30';
      case 'RETINA':
        return 'text-purple-400 border-purple-900/60 bg-purple-950/30';
      case 'AI INPUT':
        return 'text-emerald-400 border-emerald-900/60 bg-emerald-950/30';
      case 'GEMINI DECISION':
        return 'text-amber-400 border-amber-900/60 bg-amber-950/30';
      case 'TOOL CALL':
        return 'text-rose-400 border-rose-900/60 bg-rose-950/30';
      case 'TOOL RESULT':
        return 'text-teal-400 border-teal-900/60 bg-teal-950/30';
      default:
        return 'text-[#888] border-[#333] bg-[#1a1a1c]';
    }
  };

  return (
    <aside className="w-full lg:w-[340px] bg-[#0f0f10] border-l border-[#222] flex flex-col h-full text-[#e0e0e0] font-mono text-xs select-none">
      {/* 1. Internal Kinematics Section */}
      <div className="p-4 border-b border-[#222] bg-[#0f0f10]">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[10px] font-bold uppercase tracking-wider text-[#888] flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5 text-blue-400" />
            <span>INTERNAL KINEMATICS</span>
          </h2>
          <span
            className={`px-2 py-0.5 rounded text-[9px] font-mono uppercase tracking-widest border ${
              isReasoning
                ? 'bg-amber-950/50 border-amber-500 text-amber-300 animate-pulse'
                : 'bg-emerald-950/40 border-emerald-500/60 text-emerald-400'
            }`}
          >
            {isReasoning ? 'REASONING' : 'ENGAGED'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2.5 font-mono text-xs">
          <div className="bg-[#1a1a1c] p-2.5 rounded border border-[#26262b]">
            <span className="block text-[9px] text-[#666] mb-1 uppercase tracking-wider">Position (XYZ)</span>
            <span className="text-blue-400 font-semibold">
              {pose.x.toFixed(2)}, {pose.y.toFixed(2)}, {pose.z.toFixed(2)}
            </span>
          </div>
          <div className="bg-[#1a1a1c] p-2.5 rounded border border-[#26262b]">
            <span className="block text-[9px] text-[#666] mb-1 uppercase tracking-wider">Rotation (YAW)</span>
            <span className="text-blue-400 font-semibold">
              {pose.yaw.toFixed(1)}°
            </span>
          </div>
        </div>

        {/* Current Kinematic Action */}
        <div className="bg-[#1a1a1c] p-2 rounded border border-[#26262b] mt-2 text-[10px]">
          <span className="block text-[9px] text-[#666] mb-0.5 uppercase tracking-wider">Actuator Status</span>
          <div className="text-emerald-400/90 font-mono truncate">
            {currentAction || 'Stationary spectral gaze'}
          </div>
        </div>
      </div>

      {/* 2. AI Cognition Stream Section */}
      <div className="p-4 border-b border-[#222] bg-[#141416]">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[10px] font-bold uppercase tracking-wider text-[#888] flex items-center gap-1.5">
            <Brain className="w-3.5 h-3.5 text-emerald-400" />
            <span>AI COGNITION STREAM</span>
          </h2>
          <span className="text-[9px] text-emerald-500/70 font-mono uppercase tracking-widest">
            GEMINI 3.8 FLASH
          </span>
        </div>

        <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
          {/* Thought Process */}
          <div className="border-l-2 border-emerald-500 pl-3 bg-[#0a0a0b]/60 p-2 rounded-r border-y border-r border-[#222]">
            <div className="text-[9px] text-emerald-500 uppercase font-bold mb-1 tracking-wider flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              <span>THOUGHT PROCESS</span>
            </div>
            <p className="text-[11px] leading-relaxed text-[#aaa] italic font-sans">
              "{lastThought || 'Observing incoming retinal cone excitations and opponent channels across 16x16 receptive array...'}"
            </p>
          </div>

          {/* Tool Execution */}
          {lastToolCall && (
            <div className="border-l-2 border-blue-500 pl-3 bg-[#0a0a0b]/60 p-2 rounded-r border-y border-r border-[#222]">
              <div className="text-[9px] text-blue-400 uppercase font-bold mb-1 tracking-wider flex items-center gap-1">
                <Terminal className="w-3 h-3" />
                <span>TOOL EXECUTION</span>
              </div>
              <div className="bg-[#0a0a0b] p-1.5 rounded text-[10px] font-mono text-blue-300 border border-[#222]">
                {lastToolCall.name}({JSON.stringify(lastToolCall.args).replace(/["{}]/g, '')})
              </div>
              {lastToolResult && (
                <div className="text-[9px] font-sans text-teal-400 mt-1 flex items-center gap-1">
                  <CheckCircle2 className="w-2.5 h-2.5" />
                  <span>{lastToolResult}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 3. System Logs Section */}
      <div className="flex-1 p-4 flex flex-col min-h-0 bg-[#0c0c0d]">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-[10px] font-bold uppercase tracking-wider text-[#888] flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            <span>SYSTEM LOGS</span>
            <span className="text-[#555] font-normal">({filteredLogs.length})</span>
          </h2>
          <button
            onClick={onClearLogs}
            className="p-1 rounded text-[#555] hover:text-rose-400 hover:bg-[#1a1a1c] transition-colors cursor-pointer"
            title="Clear System Logs"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>

        {/* Filter Badges */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1.5 mb-2 text-[8px] font-mono scrollbar-none">
          {['ALL', 'WORLD STATE', 'ARTIFICIAL EYE', 'RETINA', 'AI INPUT', 'GEMINI DECISION', 'TOOL CALL'].map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveFilter(cat)}
              className={`px-1.5 py-0.5 rounded whitespace-nowrap transition-colors cursor-pointer border ${
                activeFilter === cat
                  ? 'bg-emerald-950/60 text-emerald-300 border-emerald-700'
                  : 'text-[#666] hover:text-[#aaa] border-[#222] bg-[#111]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Feed */}
        <div className="flex-1 font-mono text-[9px] text-[#666] space-y-1.5 overflow-y-auto pr-1">
          {filteredLogs.length === 0 ? (
            <div className="text-[#444] text-center py-6 italic">No log entries</div>
          ) : (
            filteredLogs.map((entry) => (
              <div
                key={entry.id}
                className="p-1.5 rounded bg-[#111] border border-[#222] hover:border-[#333] transition-colors"
              >
                <div className="flex items-center justify-between text-[8px] mb-0.5">
                  <span className={`px-1 py-0.2 rounded border font-semibold ${getCategoryColor(entry.category)}`}>
                    {entry.category}
                  </span>
                  <span className="text-[#555] flex items-center gap-1">
                    <Clock className="w-2 h-2" />
                    {entry.timestamp}
                  </span>
                </div>
                <div className="text-[#aaa] leading-relaxed break-words font-sans text-[10px]">
                  {entry.message}
                </div>
              </div>
            ))
          )}
          <div ref={logEndRef} />
        </div>
      </div>

      {/* 4. Spectral Lighting Profile Footer */}
      <footer className="p-3 bg-[#0a0a0b] border-t border-[#222]">
        <div className="text-[9px] text-[#555] text-center mb-1.5 uppercase tracking-widest font-mono">
          SPECTRAL LIGHTING PROFILE (400–700 NM)
        </div>
        <div className="h-5 w-full bg-gradient-to-r from-blue-700 via-cyan-400 via-green-400 via-yellow-300 to-red-600 rounded-xs opacity-50 border border-[#222]" />
      </footer>
    </aside>
  );
};
