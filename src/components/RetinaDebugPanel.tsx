import React, { useEffect, useRef, useState } from 'react';
import { Layers, Code, ChevronDown, ChevronUp } from 'lucide-react';
import { ArtificialVisionState } from '../types';
import { RETINA_RES } from '../perception/retina';

interface RetinaDebugPanelProps {
  visionState: ArtificialVisionState | null;
  humanDebugCanvasRef?: React.RefObject<HTMLCanvasElement | null>;
  showRgbDebug: boolean;
}

export const RetinaDebugPanel: React.FC<RetinaDebugPanelProps> = ({
  visionState,
  showRgbDebug,
}) => {
  const [showNumericalModal, setShowNumericalModal] = useState(false);

  // Canvases for the artificial retina channel maps
  const localRgbCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const sCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const s2CanvasRef = useRef<HTMLCanvasElement | null>(null);
  const mCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const m2CanvasRef = useRef<HTMLCanvasElement | null>(null);
  const lCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const lmCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const slmCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const edgeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const uvCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const nirCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const thermalCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Render maps whenever visionState updates
  useEffect(() => {
    if (!visionState) return;

    // 1. RGB Retina View
    if (localRgbCanvasRef.current && visionState.rgbPixelData) {
      const ctx = localRgbCanvasRef.current.getContext('2d');
      if (ctx) {
        const img = ctx.createImageData(RETINA_RES, RETINA_RES);
        const rgbData = visionState.rgbPixelData;
        for (let i = 0; i < rgbData.length; i++) {
          img.data[i] = rgbData[i];
        }
        ctx.putImageData(img, 0, 0);
      }
    }

    const renderHeatmap = (
      canvas: HTMLCanvasElement | null,
      values: number[] | undefined,
      colorFn: (val: number) => [number, number, number]
    ) => {
      if (!canvas || !values) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const img = ctx.createImageData(RETINA_RES, RETINA_RES);
      for (let i = 0; i < values.length; i++) {
        const [r, g, b] = colorFn(values[i]);
        const idx = i * 4;
        img.data[idx] = r;
        img.data[idx + 1] = g;
        img.data[idx + 2] = b;
        img.data[idx + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
    };

    // 2. S-Cone (Short-Wavelength): Blue/Cyan colormap
    renderHeatmap(sCanvasRef.current, visionState.sMap, (v) => {
      const val = Math.max(0, Math.min(1, v));
      return [
        Math.round(val * 40),
        Math.round(val * 160),
        Math.round(val * 255)
      ];
    });

    // S2-Cone (Short-Violet): Deep Violet colormap
    renderHeatmap(s2CanvasRef.current, visionState.s2Map, (v) => {
      const val = Math.max(0, Math.min(1, v));
      return [
        Math.round(val * 140),
        Math.round(val * 60),
        Math.round(val * 255)
      ];
    });

    // 3. M-Cone (Medium-Wavelength): Emerald Green colormap
    renderHeatmap(mCanvasRef.current, visionState.mMap, (v) => {
      const val = Math.max(0, Math.min(1, v));
      return [
        Math.round(val * 30),
        Math.round(val * 235),
        Math.round(val * 90)
      ];
    });

    // M2-Cone (Green-Yellow): Lime / Chartreuse colormap
    renderHeatmap(m2CanvasRef.current, visionState.m2Map, (v) => {
      const val = Math.max(0, Math.min(1, v));
      return [
        Math.round(val * 170),
        Math.round(val * 240),
        Math.round(val * 30)
      ];
    });

    // 4. L-Cone (Long-Wavelength): Red / Crimson colormap
    renderHeatmap(lCanvasRef.current, visionState.lMap, (v) => {
      const val = Math.max(0, Math.min(1, v));
      return [
        Math.round(val * 255),
        Math.round(val * 50),
        Math.round(val * 40)
      ];
    });

    // 5. L - M Opponent: Bipolar colormap (-1 to +1)
    renderHeatmap(lmCanvasRef.current, visionState.opponentLMMap, (v) => {
      if (v >= 0) {
        const t = Math.min(1, v * 1.5);
        return [
          Math.round(60 + t * 195),
          Math.round(60 * (1 - t * 0.7)),
          Math.round(60 * (1 - t * 0.8))
        ];
      } else {
        const t = Math.min(1, -v * 1.5);
        return [
          Math.round(60 * (1 - t * 0.8)),
          Math.round(60 + t * 180),
          Math.round(60 * (1 - t * 0.5))
        ];
      }
    });

    // 6. S - (L+M) Opponent: Bipolar colormap (-1 to +1)
    renderHeatmap(slmCanvasRef.current, visionState.opponentSLMMap, (v) => {
      if (v >= 0) {
        const t = Math.min(1, v * 1.5);
        return [
          Math.round(60 * (1 - t * 0.6)),
          Math.round(60 * (1 - t * 0.4)),
          Math.round(60 + t * 195)
        ];
      } else {
        const t = Math.min(1, -v * 1.5);
        return [
          Math.round(60 + t * 195),
          Math.round(60 + t * 160),
          Math.round(40 * (1 - t * 0.7))
        ];
      }
    });

    // 7. Luminance & Center-Surround Contrast Edge Map
    renderHeatmap(edgeCanvasRef.current, visionState.edgeContrastMap, (v) => {
      const val = Math.max(0, Math.min(1, v));
      return [
        Math.round(val * 255),
        Math.round(val * 255),
        Math.round(val * 255)
      ];
    });

    // 8. UV (Ultraviolet, 300-400nm): Violet / Electric Indigo colormap
    if (visionState.uvMap) {
      renderHeatmap(uvCanvasRef.current, visionState.uvMap, (v) => {
        const val = Math.max(0, Math.min(1, v));
        return [
          Math.round(val * 210),
          Math.round(val * 70),
          Math.round(val * 255)
        ];
      });
    }

    // 9. NIR (Near-Infrared, 700-1100nm): Amber / Copper colormap
    if (visionState.nirMap) {
      renderHeatmap(nirCanvasRef.current, visionState.nirMap, (v) => {
        const val = Math.max(0, Math.min(1, v));
        return [
          Math.round(val * 255),
          Math.round(val * 140),
          Math.round(val * 40)
        ];
      });
    }

    // 10. Thermal Radiance (3-12μm): Ironbow colormap
    if (visionState.thermalMap) {
      renderHeatmap(thermalCanvasRef.current, visionState.thermalMap, (v) => {
        const val = Math.max(0, Math.min(1, v));
        // Thermal ironbow: black -> purple -> red -> yellow -> white
        if (val < 0.25) {
          const t = val / 0.25;
          return [Math.round(t * 80), 0, Math.round(t * 140)];
        } else if (val < 0.5) {
          const t = (val - 0.25) / 0.25;
          return [Math.round(80 + t * 140), Math.round(t * 40), Math.round(140 * (1 - t))];
        } else if (val < 0.75) {
          const t = (val - 0.5) / 0.25;
          return [220, Math.round(40 + t * 160), 0];
        } else {
          const t = (val - 0.75) / 0.25;
          return [220 + Math.round(t * 35), 200 + Math.round(t * 55), Math.round(t * 220)];
        }
      });
    }
  }, [visionState]);

  return (
    <div className="bg-[#0c0c0d] border-t border-[#222] p-3.5 text-[#e0e0e0] select-none">
      {/* Panel Header */}
      <div className="text-[10px] font-bold uppercase tracking-widest text-[#666] flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <Layers className="w-3.5 h-3.5 text-emerald-500" />
          <span className="text-[#888]">ARTIFICIAL RETINA OUTPUT</span>
          <span className="text-[9px] font-mono text-emerald-500/60 uppercase tracking-widest">
            [{RETINA_RES}×{RETINA_RES} RECEPTIVE RECEPTORS]
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-emerald-500/50 text-[9px] uppercase tracking-wider hidden sm:inline">
            STREAMING VISUAL FEATURE SET
          </span>
          <button
            onClick={() => setShowNumericalModal(!showNumericalModal)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#18181b] hover:bg-[#222] text-[#aaa] hover:text-[#fff] border border-[#2e2e32] text-[10px] font-mono transition-colors cursor-pointer"
          >
            <Code className="w-3 h-3 text-emerald-400" />
            <span>NUMERICAL STATE</span>
            {showNumericalModal ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* Grid of 7 Photoreceptor Channels + Opponent / IR / Debug Views */}
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-9 gap-2">
        {/* 1. Human RGB View */}
        <div
          className={`bg-[#111] border rounded flex flex-col items-center justify-center p-1.5 transition-colors ${
            showRgbDebug ? 'border-[#333]' : 'border-[#222] opacity-40'
          }`}
        >
          <div className="w-full flex items-center justify-between text-[8px] font-mono text-[#777] uppercase tracking-wider mb-1 px-0.5">
            <span>1. RGB</span>
            <span className="text-amber-400/80 text-[7px] px-1 rounded bg-amber-950/60 border border-amber-900/40">
              DEBUG ONLY
            </span>
          </div>
          <div className="relative w-full aspect-square bg-[#0a0a0b] rounded-xs border border-[#222] overflow-hidden flex items-center justify-center">
            <canvas
              ref={localRgbCanvasRef}
              width={RETINA_RES}
              height={RETINA_RES}
              className="w-full h-full [image-rendering:pixelated]"
            />
            {!showRgbDebug && (
              <div className="absolute inset-0 bg-[#0a0a0b]/90 flex items-center justify-center text-[9px] font-mono text-[#555]">
                HIDDEN
              </div>
            )}
          </div>
          <span className="text-[8px] font-mono text-[#555] mt-1">CIE sRGB</span>
        </div>

        {/* 2. S-Cone */}
        <div className="bg-[#111] border border-[#222] hover:border-[#333] rounded flex flex-col items-center justify-center p-1.5 transition-colors">
          <div className="w-full flex items-center justify-between text-[8px] font-mono text-[#777] uppercase tracking-wider mb-1 px-0.5">
            <span className="text-cyan-400">2. S-CONE</span>
            <span className="text-[#555] text-[7px]">~430NM</span>
          </div>
          <div className="w-full aspect-square bg-[#0a0a0b] rounded-xs border border-[#222] overflow-hidden">
            <canvas
              ref={sCanvasRef}
              width={RETINA_RES}
              height={RETINA_RES}
              className="w-full h-full [image-rendering:pixelated]"
            />
          </div>
          <span className="text-[8px] font-mono text-[#666] mt-1">
            {visionState?.coneTotals.sTotal.toFixed(1) || '0.0'} ({((visionState?.coneTotals.sRatio || 0) * 100).toFixed(0)}%)
          </span>
        </div>

        {/* 3. S2-Cone */}
        <div className="bg-[#111] border border-[#222] hover:border-[#333] rounded flex flex-col items-center justify-center p-1.5 transition-colors">
          <div className="w-full flex items-center justify-between text-[8px] font-mono text-[#777] uppercase tracking-wider mb-1 px-0.5">
            <span className="text-purple-400">3. S2-CONE</span>
            <span className="text-[#555] text-[7px]">~480NM</span>
          </div>
          <div className="w-full aspect-square bg-[#0a0a0b] rounded-xs border border-[#222] overflow-hidden">
            <canvas
              ref={s2CanvasRef}
              width={RETINA_RES}
              height={RETINA_RES}
              className="w-full h-full [image-rendering:pixelated]"
            />
          </div>
          <span className="text-[8px] font-mono text-[#666] mt-1">
            {(visionState?.coneTotals.s2Total || 0).toFixed(1)} ({(((visionState?.coneTotals.s2Ratio || 0)) * 100).toFixed(0)}%)
          </span>
        </div>

        {/* 4. M-Cone */}
        <div className="bg-[#111] border border-[#222] hover:border-[#333] rounded flex flex-col items-center justify-center p-1.5 transition-colors">
          <div className="w-full flex items-center justify-between text-[8px] font-mono text-[#777] uppercase tracking-wider mb-1 px-0.5">
            <span className="text-emerald-400">4. M-CONE</span>
            <span className="text-[#555] text-[7px]">~530NM</span>
          </div>
          <div className="w-full aspect-square bg-[#0a0a0b] rounded-xs border border-[#222] overflow-hidden">
            <canvas
              ref={mCanvasRef}
              width={RETINA_RES}
              height={RETINA_RES}
              className="w-full h-full [image-rendering:pixelated]"
            />
          </div>
          <span className="text-[8px] font-mono text-[#666] mt-1">
            {visionState?.coneTotals.mTotal.toFixed(1) || '0.0'} ({((visionState?.coneTotals.mRatio || 0) * 100).toFixed(0)}%)
          </span>
        </div>

        {/* 5. M2-Cone */}
        <div className="bg-[#111] border border-[#222] hover:border-[#333] rounded flex flex-col items-center justify-center p-1.5 transition-colors">
          <div className="w-full flex items-center justify-between text-[8px] font-mono text-[#777] uppercase tracking-wider mb-1 px-0.5">
            <span className="text-lime-400">5. M2-CONE</span>
            <span className="text-[#555] text-[7px]">~555NM</span>
          </div>
          <div className="w-full aspect-square bg-[#0a0a0b] rounded-xs border border-[#222] overflow-hidden">
            <canvas
              ref={m2CanvasRef}
              width={RETINA_RES}
              height={RETINA_RES}
              className="w-full h-full [image-rendering:pixelated]"
            />
          </div>
          <span className="text-[8px] font-mono text-[#666] mt-1">
            {(visionState?.coneTotals.m2Total || 0).toFixed(1)} ({(((visionState?.coneTotals.m2Ratio || 0)) * 100).toFixed(0)}%)
          </span>
        </div>

        {/* 6. L-Cone */}
        <div className="bg-[#111] border border-[#222] hover:border-[#333] rounded flex flex-col items-center justify-center p-1.5 transition-colors">
          <div className="w-full flex items-center justify-between text-[8px] font-mono text-[#777] uppercase tracking-wider mb-1 px-0.5">
            <span className="text-rose-400">6. L-CONE</span>
            <span className="text-[#555] text-[7px]">~580NM</span>
          </div>
          <div className="w-full aspect-square bg-[#0a0a0b] rounded-xs border border-[#222] overflow-hidden">
            <canvas
              ref={lCanvasRef}
              width={RETINA_RES}
              height={RETINA_RES}
              className="w-full h-full [image-rendering:pixelated]"
            />
          </div>
          <span className="text-[8px] font-mono text-[#666] mt-1">
            {visionState?.coneTotals.lTotal.toFixed(1) || '0.0'} ({((visionState?.coneTotals.lRatio || 0) * 100).toFixed(0)}%)
          </span>
        </div>

        {/* 5. L-M Opponent */}
        <div className="bg-[#111] border border-[#222] hover:border-[#333] rounded flex flex-col items-center justify-center p-1.5 transition-colors">
          <div className="w-full flex items-center justify-between text-[8px] font-mono text-[#777] uppercase tracking-wider mb-1 px-0.5">
            <span className="text-amber-400">5. L-M OPP</span>
            <span className="text-[#555] text-[7px]">PARVO</span>
          </div>
          <div className="w-full aspect-square bg-[#0a0a0b] rounded-xs border border-[#222] overflow-hidden">
            <canvas
              ref={lmCanvasRef}
              width={RETINA_RES}
              height={RETINA_RES}
              className="w-full h-full [image-rendering:pixelated]"
            />
          </div>
          <span className="text-[8px] font-mono text-[#666] mt-1">LONG VS MID</span>
        </div>

        {/* 6. S-(L+M) Opponent */}
        <div className="bg-[#111] border border-[#222] hover:border-[#333] rounded flex flex-col items-center justify-center p-1.5 transition-colors">
          <div className="w-full flex items-center justify-between text-[8px] font-mono text-[#777] uppercase tracking-wider mb-1 px-0.5">
            <span className="text-indigo-400">6. S-(L+M)</span>
            <span className="text-[#555] text-[7px]">KONIO</span>
          </div>
          <div className="w-full aspect-square bg-[#0a0a0b] rounded-xs border border-[#222] overflow-hidden">
            <canvas
              ref={slmCanvasRef}
              width={RETINA_RES}
              height={RETINA_RES}
              className="w-full h-full [image-rendering:pixelated]"
            />
          </div>
          <span className="text-[8px] font-mono text-[#666] mt-1">SHORT VS M+L</span>
        </div>

        {/* 7. Contrast / DoG */}
        <div className="bg-[#111] border border-[#222] hover:border-[#333] rounded flex flex-col items-center justify-center p-1.5 transition-colors">
          <div className="w-full flex items-center justify-between text-[8px] font-mono text-[#777] uppercase tracking-wider mb-1 px-0.5">
            <span className="text-[#e0e0e0]">7. CONTRAST</span>
            <span className="text-[#555] text-[7px]">MAGNO</span>
          </div>
          <div className="w-full aspect-square bg-[#0a0a0b] rounded-xs border border-[#222] overflow-hidden">
            <canvas
              ref={edgeCanvasRef}
              width={RETINA_RES}
              height={RETINA_RES}
              className="w-full h-full [image-rendering:pixelated]"
            />
          </div>
          <span className="text-[8px] font-mono text-[#666] mt-1">
            ΔMOT: {((visionState?.temporalChangeIndex || 0) * 100).toFixed(1)}%
          </span>
        </div>

        {/* 8. UV Receptors (300-400nm) */}
        {visionState?.uvMap && (
          <div className="bg-[#111] border border-[#222] hover:border-[#333] rounded flex flex-col items-center justify-center p-1.5 transition-colors">
            <div className="w-full flex items-center justify-between text-[8px] font-mono text-[#777] uppercase tracking-wider mb-1 px-0.5">
              <span className="text-violet-400">8. UV</span>
              <span className="text-[#555] text-[7px]">~360NM</span>
            </div>
            <div className="w-full aspect-square bg-[#0a0a0b] rounded-xs border border-[#222] overflow-hidden">
              <canvas
                ref={uvCanvasRef}
                width={RETINA_RES}
                height={RETINA_RES}
                className="w-full h-full [image-rendering:pixelated]"
              />
            </div>
            <span className="text-[8px] font-mono text-[#666] mt-1">
              {visionState?.coneTotals.uvTotal?.toFixed(1) || '0.0'} (UV-A)
            </span>
          </div>
        )}

        {/* 9. NIR Receptors (700-1100nm) */}
        {visionState?.nirMap && (
          <div className="bg-[#111] border border-[#222] hover:border-[#333] rounded flex flex-col items-center justify-center p-1.5 transition-colors">
            <div className="w-full flex items-center justify-between text-[8px] font-mono text-[#777] uppercase tracking-wider mb-1 px-0.5">
              <span className="text-amber-500">9. NIR</span>
              <span className="text-[#555] text-[7px]">~850NM</span>
            </div>
            <div className="w-full aspect-square bg-[#0a0a0b] rounded-xs border border-[#222] overflow-hidden">
              <canvas
                ref={nirCanvasRef}
                width={RETINA_RES}
                height={RETINA_RES}
                className="w-full h-full [image-rendering:pixelated]"
              />
            </div>
            <span className="text-[8px] font-mono text-[#666] mt-1">
              {visionState?.coneTotals.nirTotal?.toFixed(1) || '0.0'} (REFL)
            </span>
          </div>
        )}

        {/* 10. Thermal Radiance (3-12μm) */}
        {visionState?.thermalMap && (
          <div className="bg-[#111] border border-[#222] hover:border-[#333] rounded flex flex-col items-center justify-center p-1.5 transition-colors">
            <div className="w-full flex items-center justify-between text-[8px] font-mono text-[#777] uppercase tracking-wider mb-1 px-0.5">
              <span className="text-orange-400">10. THERMAL</span>
              <span className="text-[#555] text-[7px]">3-12μM</span>
            </div>
            <div className="w-full aspect-square bg-[#0a0a0b] rounded-xs border border-[#222] overflow-hidden">
              <canvas
                ref={thermalCanvasRef}
                width={RETINA_RES}
                height={RETINA_RES}
                className="w-full h-full [image-rendering:pixelated]"
              />
            </div>
            <span className="text-[8px] font-mono text-[#666] mt-1">
              {visionState?.coneTotals.thermalTotal?.toFixed(1) || '0.0'} (FLUX)
            </span>
          </div>
        )}
      </div>

      {/* 8. Numerical State Inspector (Collapsible Data Grid) */}
      {showNumericalModal && visionState && (
        <div className="mt-3 p-3 bg-[#111] rounded border border-[#222] text-xs font-mono">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#222] text-[#aaa]">
            <span className="font-bold text-emerald-400 flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
              <Code className="w-3.5 h-3.5 text-emerald-400" />
              SENSORY MATRIX DISPATCHED TO GEMINI 3.8 FLASH (PHYSICAL INTEGRALS ONLY)
            </span>
            <span className="text-[10px] text-[#666]">
              RES: {RETINA_RES}×{RETINA_RES} | TARGETS IN FOV: {visionState.salientRegions.length}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[10px]">
            {/* Salient Proto-Regions Data Grid */}
            <div className="bg-[#141416] p-2.5 rounded border border-[#222]">
              <div className="text-[#888] font-bold mb-1.5 uppercase tracking-wider text-[10px] flex items-center justify-between">
                <span>SEGMENTED PROTO-REGIONS</span>
                <span className="text-emerald-500/70 font-normal">POLAR BEARINGS & SHAPE</span>
              </div>
              {visionState.salientRegions.length === 0 ? (
                <div className="text-[#555] italic py-2">
                  No salient proto-regions currently in field of view.
                </div>
              ) : (
                <div className="space-y-1">
                  {visionState.salientRegions.map((reg) => (
                    <div
                      key={reg.id}
                      className="bg-[#0a0a0b] p-1.5 rounded border border-[#222] flex flex-wrap justify-between gap-x-2 text-[#aaa]"
                    >
                      <span className="font-bold text-emerald-400">{reg.id}</span>
                      {reg.shapeMorphology && (
                        <span className="text-cyan-300 font-semibold">{reg.shapeMorphology}</span>
                      )}
                      <span>AZ: {reg.azimuthDeg > 0 ? `+${reg.azimuthDeg}` : reg.azimuthDeg}°</span>
                      <span>EL: {reg.elevationDeg > 0 ? `+${reg.elevationDeg}` : reg.elevationDeg}°</span>
                      <span>SPAN: {reg.angularSpanDeg}°</span>
                      {reg.angularWidthDeg && reg.angularHeightDeg && (
                        <span>{reg.angularWidthDeg}°W×{reg.angularHeightDeg}°H</span>
                      )}
                      <span>LUM: {reg.avgLuminance}</span>
                      <span className={reg.avgOpponent1_LM > 0 ? 'text-rose-400' : 'text-emerald-400'}>
                        L-M: {reg.avgOpponent1_LM}
                      </span>
                      <span className={reg.avgOpponent2_S_LM > 0 ? 'text-indigo-400' : 'text-amber-400'}>
                        S-LM: {reg.avgOpponent2_S_LM}
                      </span>
                      {reg.estimatedDistance && <span>DIST: ~{reg.estimatedDistance}M</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Pooled 4x4 Spatial Matrix */}
            <div className="bg-[#141416] p-2.5 rounded border border-[#222]">
              <div className="text-[#888] font-bold mb-1.5 uppercase tracking-wider text-[10px] flex items-center justify-between">
                <span>4×4 COARSE RECEPTIVE VECTOR</span>
                <span className="text-emerald-500/70 font-normal">LUM / L-M / S-LM</span>
              </div>
              <div className="grid grid-cols-4 gap-1">
                {visionState.spatialSummary4x4.map((cell, idx) => (
                  <div
                    key={idx}
                    className="bg-[#0a0a0b] p-1 rounded border border-[#222] text-[9px] text-center"
                  >
                    <div className="text-[#777]">L: {cell.lum}</div>
                    <div className={cell.op1_LM > 0 ? 'text-rose-400' : 'text-emerald-400'}>
                      {cell.op1_LM > 0 ? `+${cell.op1_LM}` : cell.op1_LM}
                    </div>
                    <div className={cell.op2_SLM > 0 ? 'text-indigo-400' : 'text-amber-400'}>
                      {cell.op2_SLM > 0 ? `+${cell.op2_SLM}` : cell.op2_SLM}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
