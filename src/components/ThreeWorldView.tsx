import React, { useEffect, useRef } from 'react';
import { Camera, Move } from 'lucide-react';
import { SimulatedWorld } from '../world/threeWorld';

interface ThreeWorldViewProps {
  worldRef: React.MutableRefObject<SimulatedWorld | null>;
  viewMode: 'third_person' | 'agent_pov';
}

export const ThreeWorldView: React.FC<ThreeWorldViewProps> = ({
  worldRef,
  viewMode,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver(() => {
      if (worldRef.current) {
        worldRef.current.handleResize();
      }
    });

    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
    };
  }, [worldRef]);

  return (
    <div className="relative w-full h-full bg-[#000] overflow-hidden select-none">
      {/* Three.js viewport canvas container - mounted directly and full-size */}
      <div
        id="three-viewport-canvas-mount"
        ref={containerRef}
        className="absolute inset-0 w-full h-full z-0"
      />

      {/* Optical Center Crosshair / Cursor Reticle - Literally overlays the visual view without affecting it */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-10">
        <div className="relative flex items-center justify-center">
          {/* Outer aiming ring */}
          <div className="w-8 h-8 border border-emerald-400/60 rounded-full flex items-center justify-center shadow-[0_0_10px_rgba(52,211,153,0.2)]">
            {/* Center optical targeting dot */}
            <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full shadow-[0_0_6px_rgba(52,211,153,0.9)]" />
          </div>

          {/* Horizontal and Vertical hair lines */}
          <div className="absolute w-14 h-[1px] bg-emerald-400/40 pointer-events-none" />
          <div className="absolute h-14 w-[1px] bg-emerald-400/40 pointer-events-none" />

          {/* Precision corner marks */}
          <div className="absolute -top-4 text-[9px] font-mono text-emerald-400/80 tracking-widest pointer-events-none">
            +
          </div>
        </div>
      </div>

      {/* Subtle Data Grid Coordinate Overlay (Technical Aesthetic) */}
      <div className="absolute inset-0 pointer-events-none z-5 opacity-10 flex items-center justify-center">
        <div className="w-[88%] h-[78%] border border-emerald-500/30 grid grid-cols-12 grid-rows-8">
          {Array.from({ length: 96 }).map((_, i) => (
            <div key={i} className="border-[0.5px] border-emerald-500/20" />
          ))}
        </div>
      </div>

      {/* Floating HUD Viewport Status Badge (Top-Left) */}
      <div className="absolute top-3 left-3 z-20 flex items-center gap-2 pointer-events-none">
        <div className="bg-[#0a0a0b]/85 backdrop-blur-sm px-3 py-1.5 rounded border border-[#333] text-[10px] font-mono text-[#e0e0e0] flex items-center gap-2 shadow-lg">
          <Camera className="w-3.5 h-3.5 text-emerald-400" />
          <span className="uppercase tracking-widest text-[#888]">CAMERA:</span>
          <span className="font-semibold text-emerald-400">
            {viewMode === 'agent_pov' ? 'ARTIFICIAL EYE POV' : 'LABORATORY OBSERVER'}
          </span>
        </div>

        {viewMode === 'third_person' && (
          <div className="hidden sm:flex items-center gap-1.5 bg-[#0a0a0b]/80 backdrop-blur-sm px-2.5 py-1.5 rounded text-[9px] font-mono text-[#777] border border-[#26262a]">
            <Move className="w-3 h-3 text-[#555]" />
            <span>CLICK & DRAG TO ORBIT • SCROLL TO ZOOM</span>
          </div>
        )}
      </div>

      {/* Floating Lower-Right HUD Physical Chamber Specs Box */}
      <div className="absolute bottom-3 right-3 z-20 pointer-events-none hidden md:block">
        <div className="px-3 py-2 bg-[#0a0a0b]/85 border border-[#333] rounded backdrop-blur-sm text-[10px] font-mono shadow-xl max-w-xs">
          <div className="text-[9px] uppercase tracking-wider text-[#888] mb-0.5 flex items-center justify-between">
            <span>SCENE RENDERING</span>
            <span className="text-emerald-400 font-semibold">60 FPS</span>
          </div>
          <div className="text-[10px] text-emerald-400/90 font-mono">
            32×32 RETINA • SPECTRAL SPD • COCHLEAR BINAURAL
          </div>
        </div>
      </div>
    </div>
  );
};
