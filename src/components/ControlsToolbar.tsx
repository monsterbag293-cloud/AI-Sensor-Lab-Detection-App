import React from 'react';
import {
  Play,
  Square,
  Zap,
  RotateCcw,
  Sun,
  Camera,
  Pause,
  Eye,
  Clock,
  Volume2,
  VolumeX,
  Sparkles,
  Flame,
  Activity,
  Wrench
} from 'lucide-react';
import { LIGHT_PRESETS } from '../perception/spectral';
import { SensoryToggles } from '../types';

interface ControlsToolbarProps {
  isAiRunning: boolean;
  isPaused: boolean;
  isReasoning: boolean;
  selectedLightId: string;
  viewMode: 'third_person' | 'agent_pov';
  showRgbDebug: boolean;
  showSandboxLab?: boolean;
  thinkingInterval: number;
  timeUntilNextWake: number;
  sensoryToggles?: SensoryToggles;
  showTechnicalView?: boolean;
  isDigitalVoid?: boolean;
  onToggleAi: () => void;
  onStepAiOnce: () => void;
  onTogglePause: () => void;
  onResetWorld: () => void;
  onSelectLight: (lightId: string) => void;
  onToggleViewMode: () => void;
  onToggleRgbDebug: () => void;
  onToggleSandboxLab?: () => void;
  onThinkingIntervalChange: (val: number) => void;
  onToggleSensory?: (channel: keyof SensoryToggles) => void;
  onToggleTechnicalView?: () => void;
  onToggleDigitalVoid?: () => void;
}

export const ControlsToolbar: React.FC<ControlsToolbarProps> = ({
  isAiRunning,
  isPaused,
  isReasoning,
  selectedLightId,
  viewMode,
  showRgbDebug,
  showSandboxLab,
  thinkingInterval,
  timeUntilNextWake,
  sensoryToggles,
  showTechnicalView,
  isDigitalVoid,
  onToggleAi,
  onStepAiOnce,
  onTogglePause,
  onResetWorld,
  onSelectLight,
  onToggleViewMode,
  onToggleRgbDebug,
  onToggleSandboxLab,
  onThinkingIntervalChange,
  onToggleSensory,
  onToggleTechnicalView,
  onToggleDigitalVoid,
}) => {
  return (
    <div className="bg-[#0c0c0d] border-b border-[#222] px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs select-none">
      {/* Primary Execution Control Group */}
      <div className="flex items-center flex-wrap gap-2">
        {/* Start / Stop Conscious Loop */}
        <button
          onClick={onToggleAi}
          className={`px-3.5 py-1.5 rounded text-[10px] uppercase tracking-widest font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-sm ${
            isAiRunning
              ? 'bg-[#222] hover:bg-[#333] border border-[#444] text-[#e0e0e0]'
              : 'bg-emerald-600 hover:bg-emerald-500 border border-emerald-400 text-white shadow-[0_0_12px_rgba(16,185,129,0.25)]'
          }`}
          title={isAiRunning ? 'Pause periodic conscious wake cycles' : 'Start periodic conscious wake cycles (default every 15s)'}
        >
          {isAiRunning ? (
            <>
              <Square className="w-3 h-3 fill-current text-rose-400" />
              <span>Stop Conscious Loop</span>
            </>
          ) : (
            <>
              <Play className="w-3 h-3 fill-current" />
              <span>Start Conscious Loop</span>
            </>
          )}
        </button>

        {/* Wake Now / Step Reasoning (Single Cycle) */}
        <button
          onClick={onStepAiOnce}
          disabled={isReasoning}
          className="px-3 py-1.5 bg-[#1a1a1c] hover:bg-[#252528] border border-[#333] hover:border-[#444] rounded text-[10px] uppercase tracking-widest text-[#d4d4d8] disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer flex items-center gap-1.5 font-medium"
          title="Manually wake the conscious agent right now to observe, decide, and act"
        >
          <Zap className="w-3 h-3 text-amber-400" />
          <span>Wake Now</span>
        </button>

        {/* DIGITAL VOID Mode Toggle */}
        {onToggleDigitalVoid && (
          <button
            onClick={onToggleDigitalVoid}
            className={`px-3 py-1.5 rounded text-[10px] uppercase tracking-widest font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-sm border ${
              isDigitalVoid
                ? 'bg-purple-900/80 hover:bg-purple-800 border-purple-500 text-purple-200 shadow-[0_0_12px_rgba(168,85,247,0.4)]'
                : 'bg-[#181524] hover:bg-[#231e38] border-purple-500/40 text-purple-300'
            }`}
            title="Toggle DIGITAL VOID controlled experiment mode (sensory isolation, continuous cognition, disconnected human communication)"
          >
            <Sparkles className="w-3 h-3 text-purple-400" />
            <span>{isDigitalVoid ? 'EXIT DIGITAL VOID' : 'ENTER DIGITAL VOID'}</span>
          </button>
        )}

        {/* Thinking Interval Quick Selector */}
        <div className="flex items-center gap-1 bg-[#141416] px-2 py-1 rounded border border-[#2e2e32] text-[10px]">
          <Clock className="w-3 h-3 text-[#777]" />
          <span className="text-[#666] uppercase font-mono">Sleep:</span>
          <select
            value={thinkingInterval}
            onChange={(e) => onThinkingIntervalChange(Number(e.target.value))}
            className="bg-[#0c0c0d] text-emerald-400 font-bold border border-[#333] rounded px-1.5 py-0.5 font-mono text-[10px] focus:outline-none focus:border-emerald-500 cursor-pointer"
          >
            <option value={10}>10s</option>
            <option value={15}>15s</option>
            <option value={20}>20s</option>
            <option value={30}>30s</option>
            <option value={45}>45s</option>
            <option value={60}>60s</option>
          </select>
          {isAiRunning && !isReasoning && (
            <span className="text-[9px] text-[#888] font-mono ml-1">
              (<span className="text-emerald-400 font-bold">{timeUntilNextWake.toFixed(0)}s</span>)
            </span>
          )}
        </div>

        <div className="h-5 w-[1px] bg-[#333] mx-0.5" />

        {/* Pause/Resume Continuous Simulation */}
        <button
          onClick={onTogglePause}
          className={`px-2.5 py-1.5 rounded text-[10px] uppercase tracking-widest border transition-colors cursor-pointer flex items-center gap-1.5 ${
            isPaused
              ? 'bg-amber-950/40 border-amber-500/60 text-amber-300'
              : 'bg-[#18181b] hover:bg-[#222] text-[#888] hover:text-[#bbb] border-[#2e2e32]'
          }`}
          title={isPaused ? 'Resume continuous simulation and artificial eye' : 'Pause physical simulation and retinal processing'}
        >
          {isPaused ? <Play className="w-3 h-3 text-amber-400" /> : <Pause className="w-3 h-3" />}
          <span>{isPaused ? 'Resume' : 'Pause'}</span>
        </button>

        {/* Reset World */}
        <button
          onClick={onResetWorld}
          className="px-2.5 py-1.5 bg-[#18181b] hover:bg-[#222] text-[#888] hover:text-[#bbb] border border-[#2e2e32] rounded text-[10px] uppercase tracking-widest transition-colors cursor-pointer flex items-center gap-1.5"
          title="Return agent to starting origin in test chamber"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Reset</span>
        </button>
      </div>

      {/* Sensory Apparatus & Diagnostics Controls */}
      <div className="flex items-center flex-wrap gap-2 text-[10px]">
        {/* Sensory Toggles Group (7-Cone, Hearing, UV, IR) */}
        {sensoryToggles && onToggleSensory && (
          <div className="flex items-center gap-1 bg-[#141416] p-0.5 rounded border border-[#2e2e32]">
            {/* 7-Cone Photoreceptor System Toggle */}
            <button
              onClick={() => onToggleSensory('sevenConeVision')}
              className={`px-2 py-1 rounded text-[9px] font-mono uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1 ${
                sensoryToggles.sevenConeVision !== false
                  ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-600 font-bold'
                  : 'text-[#666] hover:text-[#aaa]'
              }`}
              title="Enable/disable 7-cone photoreceptor system (UV, S, S2, M, M2, L, NIR)"
            >
              <Eye className="w-3 h-3 text-emerald-400" />
              <span>7-CONE</span>
            </button>

            {/* Hearing Toggle */}
            <button
              onClick={() => onToggleSensory('hearing')}
              className={`px-2 py-1 rounded text-[9px] font-mono uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1 ${
                sensoryToggles.hearing
                  ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-600 font-bold'
                  : 'text-[#666] hover:text-[#aaa]'
              }`}
              title="Enable/disable artificial cochlear hearing apparatus"
            >
              {sensoryToggles.hearing ? <Volume2 className="w-3 h-3 text-cyan-400" /> : <VolumeX className="w-3 h-3 text-[#666]" />}
              <span>EARS</span>
            </button>

            {/* UV Vision Toggle */}
            <button
              onClick={() => onToggleSensory('uvVision')}
              className={`px-2 py-1 rounded text-[9px] font-mono uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1 ${
                sensoryToggles.uvVision
                  ? 'bg-violet-950/80 text-violet-300 border border-violet-600 font-bold'
                  : 'text-[#666] hover:text-[#aaa]'
              }`}
              title="Enable/disable Ultraviolet (300-400nm) retinal photoreceptors"
            >
              <Sparkles className="w-3 h-3 text-violet-400" />
              <span>UV</span>
            </button>

            {/* IR / Thermal Vision Toggle */}
            <button
              onClick={() => onToggleSensory('irVision')}
              className={`px-2 py-1 rounded text-[9px] font-mono uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1 ${
                sensoryToggles.irVision
                  ? 'bg-amber-950/80 text-amber-300 border border-amber-600 font-bold'
                  : 'text-[#666] hover:text-[#aaa]'
              }`}
              title="Enable/disable Infrared (NIR + Thermal MWIR) receptors"
            >
              <Flame className="w-3 h-3 text-amber-400" />
              <span>IR</span>
            </button>
          </div>
        )}

        {/* Light SPD Selector */}
        <div className="flex items-center gap-1.5 bg-[#141416] px-2 py-1 rounded border border-[#2e2e32]">
          <Sun className="w-3 h-3 text-amber-400" />
          <span className="text-[#666] uppercase tracking-wider font-mono">LIGHT:</span>
          <select
            value={selectedLightId}
            onChange={(e) => onSelectLight(e.target.value)}
            className="bg-[#0c0c0d] text-[#e0e0e0] border border-[#333] rounded px-1.5 py-0.5 font-mono text-[10px] focus:outline-none focus:border-emerald-500 cursor-pointer"
          >
            {LIGHT_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.name}
              </option>
            ))}
          </select>
        </div>

        {/* Camera Viewport Toggle */}
        <button
          onClick={onToggleViewMode}
          className={`px-2.5 py-1.5 rounded text-[10px] uppercase tracking-widest border transition-colors cursor-pointer flex items-center gap-1.5 ${
            viewMode === 'agent_pov'
              ? 'bg-[#141416] border-emerald-500/60 text-emerald-400 font-semibold shadow-[0_0_8px_rgba(16,185,129,0.15)]'
              : 'bg-[#18181b] hover:bg-[#222] text-[#888] hover:text-[#bbb] border-[#2e2e32]'
          }`}
          title="Switch between Third-Person Laboratory View and Agent POV Camera"
        >
          <Camera className="w-3 h-3 text-emerald-400" />
          <span>{viewMode === 'agent_pov' ? 'POV Cam' : 'Lab View'}</span>
        </button>

        {/* Toggle Human RGB Debug Channel */}
        <button
          onClick={onToggleRgbDebug}
          className={`px-2 py-1.5 rounded text-[10px] uppercase tracking-widest border transition-colors cursor-pointer flex items-center gap-1.5 ${
            showRgbDebug
              ? 'bg-[#141416] text-[#bbb] border-[#333]'
              : 'bg-[#0a0a0b] text-[#555] border-[#222]'
          }`}
          title="Toggle human RGB debugging visualization (AI only perceives spectral/retinal bands)"
        >
          <Eye className="w-3 h-3 text-[#777]" />
          <span>{showRgbDebug ? 'RGB: ON' : 'RGB: OFF'}</span>
        </button>

        {/* Sandbox Mode / World Perturbation Lab Toggle */}
        {onToggleSandboxLab && (
          <button
            onClick={onToggleSandboxLab}
            className={`px-2.5 py-1.5 rounded text-[10px] uppercase tracking-widest border transition-all cursor-pointer flex items-center gap-1.5 font-bold ${
              showSandboxLab
                ? 'bg-amber-950/80 text-amber-300 border-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.25)]'
                : 'bg-[#18181b] hover:bg-[#222] text-amber-400/80 hover:text-amber-300 border-[#3a3a40]'
            }`}
            title="Open Sandbox Lab: Move objects, change shapes & colors, confuse the AI live"
          >
            <Wrench className="w-3 h-3 text-amber-400" />
            <span>Sandbox Lab</span>
          </button>
        )}

        {/* Technical View / Diagnostics Toggle */}
        {onToggleTechnicalView && (
          <button
            onClick={onToggleTechnicalView}
            className={`px-2.5 py-1.5 rounded text-[10px] uppercase tracking-widest border transition-all cursor-pointer flex items-center gap-1.5 font-bold ${
              showTechnicalView
                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-600 shadow-[0_0_8px_rgba(16,185,129,0.2)]'
                : 'bg-[#18181b] hover:bg-[#222] text-[#888] hover:text-[#ccc] border-[#333]'
            }`}
            title="Toggle Sensory Diagnostics and Technical Retinal/Auditory/Tactile Panels"
          >
            <Activity className="w-3 h-3 text-emerald-400" />
            <span>{showTechnicalView ? 'Diagnostics: ON' : 'Diagnostics: OFF'}</span>
          </button>
        )}
      </div>
    </div>
  );
};
