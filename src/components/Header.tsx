import React from 'react';
import { Cpu, Compass, Activity, Moon, Sun, Square, Sparkles } from 'lucide-react';
import { AgentPose, ConsciousStatus } from '../types';

export const AVAILABLE_GEMINI_MODELS = [
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (Fast & Stable)', badge: 'RECOMMENDED' },
  { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash (Advanced Reasoning)', badge: 'SMART' },
  { id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash Lite', badge: 'LOW LATENCY' },
  { id: 'gemini-flash-latest', label: 'Gemini Flash Latest', badge: 'AUTO' },
  { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro (Deep Reasoning)', badge: 'PRO' },
  { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash (Auto Fallback)', badge: 'FALLBACK' },
  { id: 'auto', label: 'Auto (Multi-Model Resilient)', badge: 'AUTO RETRY' },
];

interface HeaderProps {
  isAiRunning: boolean;
  isReasoning: boolean;
  consciousStatus: ConsciousStatus;
  cycleCount: number;
  timeUntilNextWake: number;
  pose: AgentPose;
  lightName: string;
  selectedModel?: string;
  onSelectModel?: (modelId: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  isAiRunning,
  isReasoning,
  consciousStatus,
  cycleCount,
  timeUntilNextWake,
  pose,
  lightName,
  selectedModel = 'gemini-3.1-flash-lite',
  onSelectModel,
}) => {
  return (
    <header className="flex items-center justify-between px-4 py-2 border-b border-[#222] bg-[#111] text-[#e0e0e0] select-none">
      {/* Brand & Mission Badge */}
      <div className="flex items-center space-x-3">
        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)] animate-pulse" />
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xs font-bold tracking-[0.2em] uppercase text-emerald-400 font-mono">
              OPHTHALMOS | PERIODIC CONSCIOUS AGENT
            </h1>
            {/* Force Load Gemini Model Selector */}
            <div className="flex items-center gap-1 bg-[#1a1a1e] px-2 py-0.5 rounded border border-emerald-500/40 text-[9px] font-mono">
              <Sparkles className="w-3 h-3 text-emerald-400" />
              <span className="text-[#888] uppercase">MODEL:</span>
              <select
                value={selectedModel}
                onChange={(e) => onSelectModel?.(e.target.value)}
                className="bg-transparent text-emerald-300 font-bold border-none focus:outline-none cursor-pointer text-[9px]"
                title="Force load specific Gemini model or use Auto Fallback"
              >
                {AVAILABLE_GEMINI_MODELS.map((m) => (
                  <option key={m.id} value={m.id} className="bg-[#111] text-[#e0e0e0]">
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-[10px] font-mono text-[#666] tracking-wider mt-0.5">
            CONTINUOUS RETINAL RADIANCE → PERIODIC CONSCIOUS WAKE → EMBODIED MOTOR ACTION
          </p>
        </div>
      </div>

      {/* Telemetry Chips & Status */}
      <div className="flex items-center flex-wrap gap-2 text-[10px] font-mono">
        {/* Illumination SPD */}
        <div className="bg-[#18181b] px-2 py-0.5 rounded border border-[#2e2e32] text-[#aaa] flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          <span className="text-[#666] uppercase">SPD:</span>
          <span className="text-[#e0e0e0] font-semibold">{lightName}</span>
        </div>

        {/* Kinematics Coordinates */}
        <div className="bg-[#18181b] px-2 py-0.5 rounded border border-[#2e2e32] text-[#aaa] flex items-center gap-1.5">
          <Compass className="w-3 h-3 text-[#666]" />
          <span>XYZ: ({pose.x.toFixed(2)}, {pose.y.toFixed(2)}, {pose.z.toFixed(2)})</span>
          <span className="text-[#444]">|</span>
          <span>YAW: {pose.yaw.toFixed(1)}°</span>
        </div>

        {/* Reasoning Cycle Count */}
        <div className="bg-[#18181b] px-2 py-0.5 rounded border border-[#2e2e32] text-[#aaa] flex items-center gap-1.5">
          <Activity className="w-3 h-3 text-emerald-400" />
          <span className="text-[#666]">WAKE CYCLE:</span>
          <span className="text-emerald-400 font-bold">#{cycleCount}</span>
        </div>

        <div className="h-4 w-[1px] bg-[#333] mx-0.5" />

        {/* Conscious Mind State Indicator */}
        <div
          className={`px-2.5 py-0.5 rounded border flex items-center gap-1.5 uppercase tracking-widest text-[9px] font-bold ${
            isReasoning || consciousStatus === 'AWAKE'
              ? 'bg-emerald-950/60 border-emerald-500 text-emerald-300 shadow-[0_0_8px_rgba(16,185,129,0.3)] animate-pulse'
              : isAiRunning
              ? 'bg-[#18181b] border-[#333] text-[#aaa]'
              : 'bg-[#141416] border-[#222] text-[#666]'
          }`}
        >
          {isReasoning || consciousStatus === 'AWAKE' ? (
            <>
              <Sun className="w-3 h-3 animate-spin text-emerald-400" />
              <span>MIND AWAKE</span>
            </>
          ) : isAiRunning ? (
            <>
              <Moon className="w-3 h-3 text-indigo-400" />
              <span>SLEEPING ({timeUntilNextWake.toFixed(0)}s)</span>
            </>
          ) : (
            <>
              <Square className="w-2.5 h-2.5 text-[#666]" />
              <span>STANDBY</span>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
