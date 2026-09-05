import React from 'react';
import {
  Hand,
  Activity,
  Zap,
  ShieldAlert,
  Gauge,
  Sparkles,
  Layers,
  CircleDot,
  Radio,
  Split
} from 'lucide-react';
import { ArtificialTactileState, ProprioceptionState, DiscoveredConsequence } from '../types';

interface TactileProprioPanelProps {
  tactileState: ArtificialTactileState | null;
  proprioState: ProprioceptionState | null;
  discoveredConsequences: DiscoveredConsequence[];
}

export const TactileProprioPanel: React.FC<TactileProprioPanelProps> = ({
  tactileState,
  proprioState,
  discoveredConsequences,
}) => {
  const hasContact = tactileState?.hasContact || false;
  const normalForce = tactileState?.totalNormalForceN || 0;
  const shearForce = tactileState?.totalShearForceN || 0;
  const deformation = tactileState?.maxDeformationMm || 0;
  const slipRisk = tactileState?.slipRisk || 0;
  const vibrationHz = tactileState?.dominantVibrationHz || 0;
  const vibrationEnergy = tactileState?.meanVibrationEnergy || 0;
  const impactSpike = tactileState?.recentImpactSpike || false;
  const roughness = tactileState?.surfaceRoughnessEstimate || 0;

  const isGripping = proprioState?.isGripping || false;
  const heldObjectId = proprioState?.heldObjectId || null;
  const armExt = (proprioState?.armExtensionRatio || 0) * 100;
  const handAperture = ((proprioState?.handApertureM || 0.08) * 100).toFixed(1);
  const loadResistance = (proprioState?.payloadMassResistance || 0) * 100;
  const fingerFlex = proprioState?.fingerFlexionDeg || { thumb: 15, index: 15, middle: 15, pinky: 15 };

  return (
    <div className="bg-[#0e0e11] border border-[#222] rounded p-3 text-[#ddd] text-xs font-mono select-none">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 mb-3 border-b border-[#222]">
        <div className="flex items-center gap-2">
          <Hand className="w-4 h-4 text-amber-400" />
          <span className="font-bold text-amber-300 uppercase tracking-wider text-[11px]">
            BIOLOGICAL ARTIFICIAL SKIN & PROPRIOCEPTION
          </span>
        </div>
        <div className="flex items-center gap-2">
          {impactSpike && (
            <span className="px-1.5 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-600 text-[9px] font-bold animate-pulse flex items-center gap-1">
              <Zap className="w-2.5 h-2.5" /> IMPACT TRANSIENT
            </span>
          )}
          <span
            className={`px-2 py-0.5 rounded border text-[9px] font-bold uppercase tracking-wider ${
              hasContact
                ? 'bg-amber-950/70 text-amber-300 border-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.2)]'
                : 'bg-[#18181b] text-[#666] border-[#333]'
            }`}
          >
            {hasContact ? 'CONTACT DETECTED' : 'FREE AIR (NO CONTACT)'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* 1. Tactile Mechanoreceptors Matrix */}
        <div className="bg-[#141418] p-2.5 rounded border border-[#26262e] space-y-2">
          <div className="text-[9px] font-bold text-[#888] uppercase tracking-wider flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Radio className="w-3 h-3 text-amber-400" />
              <span>MECHANORECEPTOR ARRAY</span>
            </span>
            <span className="text-[#555] text-[8px]">SA-I / SA-II / RA-I / PC</span>
          </div>

          {/* Hand Receptor Active Zones */}
          <div className="grid grid-cols-5 gap-1 text-[8px] text-center">
            {['thumb_tip', 'index_tip', 'middle_tip', 'pinky_tip', 'palm'].map((zone) => {
              const active = tactileState?.contactRegions.includes(zone);
              return (
                <div
                  key={zone}
                  className={`p-1 rounded border transition-colors ${
                    active
                      ? 'bg-amber-950/80 border-amber-500 text-amber-300 font-bold'
                      : 'bg-[#0c0c0e] border-[#222] text-[#555]'
                  }`}
                >
                  <div className="truncate">{zone.replace('_tip', '')}</div>
                  <div className="text-[7px]">{active ? 'ON' : 'OFF'}</div>
                </div>
              );
            })}
          </div>

          {/* Normal Compression Force & Indentation */}
          <div className="space-y-1 text-[10px]">
            <div className="flex justify-between text-[#aaa]">
              <span>Normal Force (SA-I/SA-II):</span>
              <span className="font-bold text-amber-400">{normalForce.toFixed(1)} N</span>
            </div>
            <div className="w-full bg-[#0a0a0c] h-1.5 rounded-full overflow-hidden border border-[#222]">
              <div
                className="bg-amber-400 h-full transition-all duration-150"
                style={{ width: `${Math.min(100, (normalForce / 50) * 100)}%` }}
              />
            </div>

            <div className="flex justify-between text-[#aaa] pt-1">
              <span>Skin Indentation Deformation:</span>
              <span className="font-bold text-cyan-400">{deformation.toFixed(2)} mm</span>
            </div>
            <div className="w-full bg-[#0a0a0c] h-1.5 rounded-full overflow-hidden border border-[#222]">
              <div
                className="bg-cyan-400 h-full transition-all duration-150"
                style={{ width: `${Math.min(100, (deformation / 6) * 100)}%` }}
              />
            </div>
          </div>

          {/* Shear Force & Slip Warning */}
          <div className="pt-1 border-t border-[#222] text-[10px] space-y-1">
            <div className="flex justify-between text-[#aaa]">
              <span>Shear Friction (RA-I):</span>
              <span className="text-[#ccc]">{shearForce.toFixed(2)} N</span>
            </div>
            <div className="flex justify-between text-[#aaa] items-center">
              <span>Slip Risk Ratio:</span>
              <span
                className={`px-1 rounded text-[9px] font-bold ${
                  slipRisk > 0.6
                    ? 'bg-rose-950 text-rose-300 border border-rose-700'
                    : 'text-emerald-400'
                }`}
              >
                {(slipRisk * 100).toFixed(0)}% {slipRisk > 0.6 ? 'SLIPPING' : 'STABLE'}
              </span>
            </div>
          </div>
        </div>

        {/* 2. Micro-Vibration & Texture (Pacinian Receptors) */}
        <div className="bg-[#141418] p-2.5 rounded border border-[#26262e] space-y-2">
          <div className="text-[9px] font-bold text-[#888] uppercase tracking-wider flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Activity className="w-3 h-3 text-teal-400" />
              <span>DYNAMIC PACINIAN VIBRATION</span>
            </span>
            <span className="text-[#555] text-[8px]">10–400 Hz</span>
          </div>

          <div className="bg-[#0a0a0c] p-2 rounded border border-[#222] text-[10px] space-y-1.5">
            <div className="flex justify-between">
              <span className="text-[#777]">Frequency Dominance:</span>
              <span className="text-teal-300 font-bold">{vibrationHz > 0 ? `${vibrationHz.toFixed(0)} Hz` : 'Quiet'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#777]">Acoustic Energy:</span>
              <span className="text-teal-400">{vibrationEnergy.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#777]">Surface Roughness:</span>
              <span className="text-amber-400 font-semibold">{roughness.toFixed(2)} Ra</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#777]">Grip Stability Score:</span>
              <span className="text-emerald-400 font-semibold">
                {((tactileState?.gripStability || 0) * 100).toFixed(0)}%
              </span>
            </div>
          </div>

          {/* Micro-Motion simulated oscilloscope trace */}
          <div className="bg-[#08080a] p-1 rounded border border-[#1e1e24] h-12 flex items-center justify-center overflow-hidden relative">
            <svg className="w-full h-full text-teal-400/80" viewBox="0 0 100 40">
              <path
                d={
                  vibrationEnergy > 0.1
                    ? 'M 0 20 Q 10 5, 20 20 T 40 20 T 60 10 T 80 30 T 100 20'
                    : 'M 0 20 L 100 20'
                }
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              />
            </svg>
            <span className="absolute bottom-1 right-1 text-[7px] text-[#555] font-mono">
              PACINIAN SENSOR
            </span>
          </div>
        </div>

        {/* 3. Proprioception, Limbs & Kinematics */}
        <div className="bg-[#141418] p-2.5 rounded border border-[#26262e] space-y-2">
          <div className="text-[9px] font-bold text-[#888] uppercase tracking-wider flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Gauge className="w-3 h-3 text-indigo-400" />
              <span>PROPRIOCEPTION & KINEMATICS</span>
            </span>
            <span className="text-[#555] text-[8px]">JOINT SENSORS</span>
          </div>

          <div className="space-y-1 text-[10px]">
            <div className="flex justify-between text-[#aaa]">
              <span>Arm Extension Ratio:</span>
              <span className="font-bold text-indigo-300">{armExt.toFixed(0)}%</span>
            </div>
            <div className="w-full bg-[#0a0a0c] h-1.5 rounded-full overflow-hidden border border-[#222]">
              <div
                className="bg-indigo-400 h-full transition-all duration-150"
                style={{ width: `${armExt}%` }}
              />
            </div>

            <div className="flex justify-between text-[#aaa] pt-1">
              <span>Hand Aperture:</span>
              <span className="text-[#ccc]">{handAperture} cm</span>
            </div>

            <div className="flex justify-between text-[#aaa] pt-0.5">
              <span>Grip Status:</span>
              <span
                className={`px-1 rounded text-[9px] font-bold ${
                  isGripping
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-600'
                    : 'text-[#666]'
                }`}
              >
                {isGripping ? `HOLDING (${heldObjectId})` : 'OPEN HAND'}
              </span>
            </div>

            <div className="flex justify-between text-[#aaa] pt-1">
              <span>Kinesthetic Load / Inertia:</span>
              <span className="text-amber-400 font-bold">{loadResistance.toFixed(0)}%</span>
            </div>
            <div className="w-full bg-[#0a0a0c] h-1.5 rounded-full overflow-hidden border border-[#222]">
              <div
                className="bg-amber-500 h-full transition-all duration-150"
                style={{ width: `${loadResistance}%` }}
              />
            </div>
          </div>

          {/* Finger Flexion Degrees Mini Bars */}
          <div className="pt-1.5 border-t border-[#222]">
            <div className="text-[8px] text-[#666] uppercase mb-1">Finger Flexion Angles:</div>
            <div className="grid grid-cols-4 gap-1 text-[8px] text-center">
              {[
                { name: 'Thumb', val: fingerFlex.thumb },
                { name: 'Index', val: fingerFlex.index },
                { name: 'Mid', val: fingerFlex.middle },
                { name: 'Pinky', val: fingerFlex.pinky },
              ].map((f) => (
                <div key={f.name} className="bg-[#0c0c0e] p-1 rounded border border-[#222]">
                  <div className="text-[#666]">{f.name}</div>
                  <div className="text-indigo-300 font-bold">{f.val.toFixed(0)}°</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Discovered Physical Properties Log (Persistent Discoveries) */}
      {discoveredConsequences.length > 0 && (
        <div className="mt-3 pt-2.5 border-t border-[#222]">
          <div className="text-[9px] font-bold text-amber-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span>DISCOVERED MECHANICAL PROPERTIES (DISCOVERY-BASED EMPIRICAL LEARNING)</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {discoveredConsequences.slice(-4).map((c) => (
              <div
                key={c.id}
                className="bg-[#131317] p-2 rounded border border-amber-900/50 text-[10px] space-y-0.5"
              >
                <div className="flex items-center justify-between text-[8px] text-[#777]">
                  <span className="text-amber-400 font-bold uppercase">Cycle #{c.cycleLearned} [{c.actionUsed}]</span>
                  <span>{c.appliedForceLevel}</span>
                </div>
                <div className="text-[#ddd] font-sans font-medium">{c.inferredProperty || c.discoveredProperty}</div>
                <div className="text-[9px] text-[#888] font-sans italic">{c.sensoryOutcome}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
