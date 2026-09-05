import React from 'react';
import { Volume2, VolumeX, Activity, Radio, Waves, Zap, Compass } from 'lucide-react';
import { ArtificialAuditoryState } from '../types';

interface AuditoryDebugPanelProps {
  auditoryState: ArtificialAuditoryState | null;
  enabled: boolean;
  onToggleHearing?: () => void;
}

// 16 ERB-spaced frequency labels for cochlear hair-cell channels
const COCHLEAR_FREQUENCIES = [
  '80Hz', '140Hz', '230Hz', '380Hz', '600Hz', '950Hz',
  '1.5k', '2.3k', '3.4k', '4.8k', '6.5k', '8.5k',
  '10.5k', '12.5k', '14k', '16k'
];

export const AuditoryDebugPanel: React.FC<AuditoryDebugPanelProps> = ({
  auditoryState,
  enabled,
  onToggleHearing,
}) => {
  const leftCochlea = auditoryState?.leftCochlea || new Array(16).fill(0);
  const rightCochlea = auditoryState?.rightCochlea || new Array(16).fill(0);

  const binauralEnergy = auditoryState?.binauralEnergy || 0;
  const itdUs = auditoryState?.interauralTimeDiff_us || 0;
  const ildDb = auditoryState?.interauralLevelDiff_dB || 0;
  const centroidHz = Math.round(auditoryState?.spectralCentroidHz || 0);
  const dominantHz = Math.round(auditoryState?.dominantFrequencyHz || 0);
  const isTransient = auditoryState?.onsetTransientDetected || false;
  const activeSources = auditoryState?.activeAcousticSources || [];

  // Left vs Right power
  const leftPower = leftCochlea.reduce((a, b) => a + b, 0) / (leftCochlea.length || 1);
  const rightPower = rightCochlea.reduce((a, b) => a + b, 0) / (rightCochlea.length || 1);

  return (
    <div className="bg-[#0c0c0d] border-t border-[#222] p-3.5 text-[#e0e0e0] select-none font-mono">
      {/* Header */}
      <div className="text-[10px] font-bold uppercase tracking-widest text-[#666] flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-[#888]">ARTIFICIAL COCHLEAR AUDITORY APPARATUS</span>
          <span className="text-[9px] text-cyan-500/60 uppercase tracking-widest">
            [16 ERB BANDS • BINAURAL ITD/ILD]
          </span>
        </div>

        <div className="flex items-center gap-3">
          {isTransient && (
            <span className="flex items-center gap-1 text-rose-400 text-[9px] font-bold animate-pulse">
              <Zap className="w-3 h-3 text-rose-400" />
              ACOUSTIC ONSET TRANSIENT
            </span>
          )}
          {onToggleHearing && (
            <button
              onClick={onToggleHearing}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] transition cursor-pointer ${
                enabled
                  ? 'bg-cyan-950 text-cyan-300 border border-cyan-700'
                  : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
              }`}
            >
              {enabled ? <Volume2 className="w-3 h-3" /> : <VolumeX className="w-3 h-3" />}
              <span>{enabled ? 'HEARING ACTIVE' : 'HEARING MUTED'}</span>
            </button>
          )}
        </div>
      </div>

      {!enabled ? (
        <div className="p-4 bg-[#111114] border border-[#222] rounded text-center text-xs text-[#666]">
          Artificial hearing channel is currently deactivated in sensory toggles.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 text-xs">
          {/* 16-Channel Cochlear Spectrogram Hair Cells (Left vs Right) */}
          <div className="lg:col-span-8 bg-[#111114] border border-[#222] rounded p-2.5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-[9px] text-[#777] uppercase tracking-wider mb-1.5 pb-1 border-b border-[#222]">
              <span className="flex items-center gap-1 text-cyan-300 font-bold">
                <Waves className="w-3 h-3 text-cyan-400" />
                COCHLEAR FILTERBANK EXCITATIONS (16 ERB BANDS)
              </span>
              <span className="text-[#666]">
                DOMINANT: {dominantHz > 0 ? `${dominantHz} Hz` : 'NONE'} | CENTROID: {centroidHz} Hz
              </span>
            </div>

            {/* Visualizer: Bars per ERB Band for Left (Cyan) and Right (Indigo) */}
            <div className="grid grid-cols-16 gap-1 h-24 items-end bg-[#0a0a0b] p-1.5 rounded border border-[#1f1f23]">
              {COCHLEAR_FREQUENCIES.map((label, idx) => {
                const lVal = Math.min(1, Math.max(0, leftCochlea[idx] || 0));
                const rVal = Math.min(1, Math.max(0, rightCochlea[idx] || 0));
                const maxVal = Math.max(lVal, rVal);

                return (
                  <div key={idx} className="flex flex-col h-full items-center justify-end gap-0.5 group relative">
                    {/* Tooltip on hover */}
                    <div className="hidden group-hover:block absolute -top-8 bg-zinc-900 border border-zinc-700 px-1.5 py-0.5 rounded text-[8px] z-10 whitespace-nowrap text-cyan-300 shadow">
                      {label}: L {(lVal * 100).toFixed(0)}% | R {(rVal * 100).toFixed(0)}%
                    </div>

                    <div className="w-full flex items-end justify-center gap-[1px] h-full">
                      {/* Left ear bar */}
                      <div
                        className="w-1/2 bg-cyan-400 rounded-t-xs transition-all duration-75"
                        style={{ height: `${Math.max(4, lVal * 100)}%`, opacity: lVal > 0.05 ? 0.9 : 0.2 }}
                      />
                      {/* Right ear bar */}
                      <div
                        className="w-1/2 bg-indigo-400 rounded-t-xs transition-all duration-75"
                        style={{ height: `${Math.max(4, rVal * 100)}%`, opacity: rVal > 0.05 ? 0.9 : 0.2 }}
                      />
                    </div>
                    <span className="text-[7px] text-[#555] tracking-tighter truncate w-full text-center">
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between text-[8px] text-[#666] mt-1.5 px-1">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-xs bg-cyan-400" />
                  LEFT EAR
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-xs bg-indigo-400" />
                  RIGHT EAR
                </span>
              </div>
              <span>BASILAR MEMBRANE TONOTOPIC TONAL MAPPING</span>
            </div>
          </div>

          {/* Binaural Spatial Localization (ITD / ILD / Azimuth) */}
          <div className="lg:col-span-4 bg-[#111114] border border-[#222] rounded p-2.5 flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between text-[9px] text-[#777] uppercase tracking-wider pb-1 border-b border-[#222]">
              <span className="flex items-center gap-1 text-emerald-400 font-bold">
                <Compass className="w-3 h-3 text-emerald-400" />
                BINAURAL SPATIAL CUES
              </span>
              <span className="text-emerald-500/70">
                {binauralEnergy > 0.05 ? `${(binauralEnergy * 100).toFixed(0)}% RMS` : 'QUIET'}
              </span>
            </div>

            {/* Left vs Right Ear SPL Meters */}
            <div className="space-y-1 text-[10px]">
              <div className="flex items-center justify-between text-[#888]">
                <span>LEFT EAR LEVEL</span>
                <span className="text-cyan-400 font-bold">{(leftPower * 100).toFixed(1)}%</span>
              </div>
              <div className="w-full h-1.5 bg-[#0a0a0b] rounded-full overflow-hidden border border-[#222]">
                <div
                  className="h-full bg-cyan-400 transition-all duration-100"
                  style={{ width: `${Math.min(100, leftPower * 100)}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[#888] pt-1">
                <span>RIGHT EAR LEVEL</span>
                <span className="text-indigo-400 font-bold">{(rightPower * 100).toFixed(1)}%</span>
              </div>
              <div className="w-full h-1.5 bg-[#0a0a0b] rounded-full overflow-hidden border border-[#222]">
                <div
                  className="h-full bg-indigo-400 transition-all duration-100"
                  style={{ width: `${Math.min(100, rightPower * 100)}%` }}
                />
              </div>
            </div>

            {/* Binaural Differentials */}
            <div className="grid grid-cols-2 gap-2 text-[9px] bg-[#0a0a0b] p-1.5 rounded border border-[#222]">
              <div>
                <span className="text-[#666] block">ITD (TIME DELAY)</span>
                <span className="text-[#bbb] font-bold">
                  {itdUs > 0 ? `+${itdUs.toFixed(0)}` : itdUs.toFixed(0)} μs
                </span>
                <span className="text-[7px] text-[#555] block">
                  {Math.abs(itdUs) < 30 ? 'CENTER' : itdUs > 0 ? 'LEFT BIAS' : 'RIGHT BIAS'}
                </span>
              </div>

              <div>
                <span className="text-[#666] block">ILD (HEAD SHADOW)</span>
                <span className="text-[#bbb] font-bold">
                  {ildDb > 0 ? `+${ildDb.toFixed(1)}` : ildDb.toFixed(1)} dB
                </span>
                <span className="text-[7px] text-[#555] block">
                  {Math.abs(ildDb) < 1.0 ? 'BALANCED' : ildDb > 0 ? 'LEFT SHADOW' : 'RIGHT SHADOW'}
                </span>
              </div>
            </div>

            {/* Active Sources Summary */}
            <div className="text-[9px] text-[#888]">
              <span className="text-[#666] uppercase text-[8px] tracking-wider block mb-0.5">
                ACTIVE SOUND SOURCES ({activeSources.length})
              </span>
              {activeSources.length === 0 ? (
                <span className="text-[#555] italic text-[8px]">Chamber ambient floor only</span>
              ) : (
                <div className="space-y-0.5 max-h-12 overflow-y-auto">
                  {activeSources.map((src, i) => (
                    <div key={i} className="flex items-center justify-between text-[8px] text-cyan-200/90 bg-[#16161a] px-1 py-0.5 rounded">
                      <span className="uppercase font-semibold">{src.type}</span>
                      <span>{src.bearingAzimuthDeg > 0 ? `+${src.bearingAzimuthDeg}°` : `${src.bearingAzimuthDeg}°`}</span>
                      <span>{src.distanceM.toFixed(1)}m</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
