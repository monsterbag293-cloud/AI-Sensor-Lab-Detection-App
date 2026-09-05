import React, { useState, useEffect } from 'react';
import {
  Wrench,
  Move,
  RotateCw,
  RotateCcw,
  Compass,
  Palette,
  Shapes,
  Sparkles,
  Plus,
  Trash2,
  Shuffle,
  Eye,
  AlertCircle,
  X,
  Layers,
  Flame,
  Sun,
  RefreshCw
} from 'lucide-react';
import { SimulatedWorld } from '../world/threeWorld';

interface SandboxInspectorProps {
  world: SimulatedWorld | null;
  isOpen: boolean;
  onClose: () => void;
  onPerturbationCreated?: (msg: string) => void;
}

const SPECTRAL_PRESETS = [
  { id: 'red_sample', name: 'Crimson (L-Cone / 650nm)', hex: '#e53935', num: 0xe53935 },
  { id: 'green_sample', name: 'Emerald (M-Cone / 540nm)', hex: '#43a047', num: 0x43a047 },
  { id: 'blue_sample', name: 'Cobalt (S-Cone / 440nm)', hex: '#1e88e5', num: 0x1e88e5 },
  { id: 'yellow_sample', name: 'Solar (M+L Yellow / 580nm)', hex: '#fbc02d', num: 0xfbc02d },
  { id: 'torus_magenta', name: 'UV Fluorescent (360nm Peak)', hex: '#8e24aa', num: 0x8e24aa },
  { id: 'prism_cyan', name: 'Cyan Fluorescent (490nm)', hex: '#00acc1', num: 0x00acc1 },
  { id: 'hex_amber', name: 'Infrared Thermal (350K Radiance)', hex: '#ff6f00', num: 0xff6f00 },
  { id: 'white_sample', name: 'Alabaster Ceramic (Broadband)', hex: '#f5f5f5', num: 0xf5f5f5 },
  { id: 'dark_grey', name: 'Stealth Matte Absorber', hex: '#263238', num: 0x263238 },
];

const SHAPE_PRESETS = [
  { id: 'box', label: 'Box / Cube' },
  { id: 'sphere', label: 'Sphere' },
  { id: 'cylinder', label: 'Cylinder' },
  { id: 'cone', label: 'Cone' },
  { id: 'torus', label: 'Torus Ring' },
  { id: 'prism', label: 'Prism' },
];

export const SandboxInspector: React.FC<SandboxInspectorProps> = ({
  world,
  isOpen,
  onClose,
  onPerturbationCreated,
}) => {
  const [objects, setObjects] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [posX, setPosX] = useState<number>(0);
  const [posY, setPosY] = useState<number>(0.6);
  const [posZ, setPosZ] = useState<number>(0);
  const [rotX, setRotX] = useState<number>(0);
  const [rotY, setRotY] = useState<number>(0);
  const [rotZ, setRotZ] = useState<number>(0);
  const [isSpawnModalOpen, setIsSpawnModalOpen] = useState(false);
  const [newObjName, setNewObjName] = useState('New Artifact');
  const [newObjShape, setNewObjShape] = useState<'box' | 'sphere' | 'cylinder' | 'cone' | 'torus'>('box');
  const [newObjPreset, setNewObjPreset] = useState(SPECTRAL_PRESETS[0].id);

  // Refresh objects list periodically or when open
  const refreshObjects = () => {
    if (!world) return;
    const objs = world.getSandboxObjects();
    setObjects(objs);
    if (!selectedId && objs.length > 0) {
      setSelectedId(objs[0].id);
      setPosX(objs[0].position[0]);
      setPosY(objs[0].position[1]);
      setPosZ(objs[0].position[2]);
      if (objs[0].rotation) {
        setRotX(Math.round(objs[0].rotation[0]));
        setRotY(Math.round(objs[0].rotation[1]));
        setRotZ(Math.round(objs[0].rotation[2]));
      }
      world.selectSandboxObject(objs[0].id);
    } else if (selectedId) {
      const cur = objs.find((o) => o.id === selectedId);
      if (cur) {
        setPosX(cur.position[0]);
        setPosY(cur.position[1]);
        setPosZ(cur.position[2]);
        if (cur.rotation) {
          setRotX(Math.round(cur.rotation[0]));
          setRotY(Math.round(cur.rotation[1]));
          setRotZ(Math.round(cur.rotation[2]));
        }
      }
    }
  };

  useEffect(() => {
    if (isOpen) {
      refreshObjects();
    } else if (world) {
      world.selectSandboxObject(null);
    }
  }, [isOpen, world]);

  const handleSelectObject = (id: string) => {
    setSelectedId(id);
    if (!world) return;
    world.selectSandboxObject(id);
    const cur = objects.find((o) => o.id === id);
    if (cur) {
      setPosX(cur.position[0]);
      setPosY(cur.position[1]);
      setPosZ(cur.position[2]);
      if (cur.rotation) {
        setRotX(Math.round(cur.rotation[0]));
        setRotY(Math.round(cur.rotation[1]));
        setRotZ(Math.round(cur.rotation[2]));
      }
    }
  };

  const handlePositionChange = (x: number, y: number, z: number) => {
    setPosX(x);
    setPosY(y);
    setPosZ(z);
    if (!world || !selectedId) return;
    world.moveSandboxObject(selectedId, [x, y, z]);
    refreshObjects();
    onPerturbationCreated?.(`Relocated object to [${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)}]`);
  };

  const handleRotationChange = (rx: number, ry: number, rz: number) => {
    setRotX(rx);
    setRotY(ry);
    setRotZ(rz);
    if (!world || !selectedId) return;
    world.rotateSandboxObject(selectedId, [rx, ry, rz]);
    refreshObjects();
    onPerturbationCreated?.(`Oriented object to [Pitch: ${rx}°, Yaw: ${ry}°, Roll: ${rz}°]`);
  };

  const handleRotateDelta = (axis: 'x' | 'y' | 'z', deltaDeg: number) => {
    if (!world || !selectedId) return;
    world.rotateSandboxObjectDelta(selectedId, axis, deltaDeg);
    refreshObjects();
    onPerturbationCreated?.(`Rotated object ${deltaDeg > 0 ? '+' : ''}${deltaDeg}° on ${axis.toUpperCase()}-axis`);
  };

  const handleResetRotation = () => {
    if (!world || !selectedId) return;
    world.resetSandboxObjectRotation(selectedId);
    setRotX(0);
    setRotY(0);
    setRotZ(0);
    refreshObjects();
    onPerturbationCreated?.(`Reset object orientation to [0°, 0°, 0°]`);
  };

  const handleColorChange = (preset: typeof SPECTRAL_PRESETS[0]) => {
    if (!world || !selectedId) return;
    world.changeSandboxObjectColor(selectedId, preset.num, preset.id, preset.name);
    refreshObjects();
    onPerturbationCreated?.(`Transformed spectral profile to ${preset.name}`);
  };

  const handleShapeChange = (shape: any) => {
    if (!world || !selectedId) return;
    world.changeSandboxObjectShape(selectedId, shape);
    refreshObjects();
    onPerturbationCreated?.(`Morphed geometry into ${shape.toUpperCase()}`);
  };

  const handleConfuseAI = () => {
    if (!world) return;
    world.randomizeSandboxConfusion();
    refreshObjects();
    onPerturbationCreated?.('Spontaneous perturbation triggered! AI sensory state confused.');
  };

  const handleSpawn = () => {
    if (!world) return;
    const preset = SPECTRAL_PRESETS.find((p) => p.id === newObjPreset) || SPECTRAL_PRESETS[0];
    const newId = world.spawnSandboxObject(
      newObjName,
      newObjShape,
      preset.num,
      preset.id,
      [(Math.random() - 0.5) * 3, 0.6, (Math.random() - 0.5) * 3]
    );
    setIsSpawnModalOpen(false);
    refreshObjects();
    setSelectedId(newId);
    world.selectSandboxObject(newId);
    onPerturbationCreated?.(`Spawned "${newObjName}" in the simulation chamber.`);
  };

  const handleDelete = () => {
    if (!world || !selectedId) return;
    world.deleteSandboxObject(selectedId);
    setSelectedId('');
    refreshObjects();
    onPerturbationCreated?.('Object removed from the chamber.');
  };

  if (!isOpen) return null;

  const currentObj = objects.find((o) => o.id === selectedId);

  return (
    <div className="absolute top-14 right-4 z-40 w-80 sm:w-96 bg-[#111113]/95 backdrop-blur-md border border-[#2a2a30] rounded-xl shadow-2xl p-4 text-xs font-sans text-[#e0e0e0] max-h-[85vh] overflow-y-auto custom-scrollbar animate-in fade-in zoom-in-95 duration-200">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#222]">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400">
            <Wrench className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-semibold text-white tracking-wide flex items-center gap-1.5">
              <span>SANDBOX LAB</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono font-normal">
                LIVE PERTURBATION
              </span>
            </h3>
            <p className="text-[10px] text-[#888]">Manipulate objects live to confuse & test AI sensory adaptation</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-md text-[#888] hover:text-white hover:bg-[#222] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Surprise Confuser AI Button */}
      <div className="mb-4">
        <button
          onClick={handleConfuseAI}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-gradient-to-r from-amber-600/30 via-rose-600/30 to-purple-600/30 hover:from-amber-600/40 hover:via-rose-600/40 hover:to-purple-600/40 border border-amber-500/40 text-amber-200 font-medium transition-all shadow-sm active:scale-[0.99] cursor-pointer"
        >
          <Shuffle className="w-3.5 h-3.5 text-amber-400 animate-spin-slow" />
          <span>Surprise Confuse AI (Sudden Morph & Jump)</span>
        </button>
      </div>

      {/* Object Selection */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-[10px] font-mono uppercase tracking-wider text-[#999] flex items-center gap-1">
            <Shapes className="w-3 h-3 text-cyan-400" />
            <span>Target Chamber Object</span>
          </label>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsSpawnModalOpen(true)}
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-400 border border-emerald-800/50 text-[10px] transition-colors"
            >
              <Plus className="w-3 h-3" />
              <span>Spawn</span>
            </button>
            {currentObj && (
              <button
                onClick={handleDelete}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-950/60 hover:bg-rose-900/60 text-rose-400 border border-rose-800/50 text-[10px] transition-colors"
                title="Delete selected object"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        <select
          value={selectedId}
          onChange={(e) => handleSelectObject(e.target.value)}
          className="w-full bg-[#18181b] border border-[#2e2e34] rounded-lg px-2.5 py-1.5 text-white font-mono text-xs focus:outline-none focus:border-cyan-500 transition-colors"
        >
          {objects.map((obj) => (
            <option key={obj.id} value={obj.id}>
              {obj.name} ({obj.shape}) - {obj.spectralProfileName}
            </option>
          ))}
        </select>
      </div>

      {currentObj && (
        <div className="space-y-4 pt-1">
          {/* Morph Shape */}
          <div>
            <label className="text-[10px] font-mono uppercase tracking-wider text-[#999] flex items-center gap-1 mb-1.5">
              <Shapes className="w-3 h-3 text-purple-400" />
              <span>Morph Geometry Shape</span>
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {SHAPE_PRESETS.map((shape) => (
                <button
                  key={shape.id}
                  onClick={() => handleShapeChange(shape.id)}
                  className={`py-1.5 px-2 rounded-md font-mono text-[10px] border transition-all text-center ${
                    currentObj.shape === shape.id
                      ? 'bg-purple-950/60 border-purple-500 text-purple-200 font-bold'
                      : 'bg-[#18181b] border-[#2a2a30] text-[#aaa] hover:text-white hover:border-[#444]'
                  }`}
                >
                  {shape.label}
                </button>
              ))}
            </div>
          </div>

          {/* Change Color & Spectral Profile */}
          <div>
            <label className="text-[10px] font-mono uppercase tracking-wider text-[#999] flex items-center gap-1 mb-1.5">
              <Palette className="w-3 h-3 text-rose-400" />
              <span>Spectral Reflectance & Color</span>
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {SPECTRAL_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => handleColorChange(preset)}
                  className={`flex items-center gap-1.5 p-1.5 rounded-md border text-left transition-all ${
                    currentObj.spectralProfileName === preset.id
                      ? 'bg-[#222] border-white text-white'
                      : 'bg-[#18181b] border-[#2a2a30] text-[#aaa] hover:text-white hover:border-[#444]'
                  }`}
                >
                  <span
                    className="w-3 h-3 rounded-full shrink-0 border border-black/50"
                    style={{ backgroundColor: preset.hex }}
                  />
                  <span className="truncate text-[9px]">{preset.name.split(' ')[0]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Move Position in 3D Space */}
          <div>
            <label className="text-[10px] font-mono uppercase tracking-wider text-[#999] flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1">
                <Move className="w-3 h-3 text-amber-400" />
                <span>Move in Chamber Space (X, Y, Z)</span>
              </div>
              <span className="text-[9px] text-[#666] font-mono">
                [{posX.toFixed(1)}, {posY.toFixed(1)}, {posZ.toFixed(1)}]m
              </span>
            </label>

            {/* Quick Movement Buttons */}
            <div className="grid grid-cols-4 gap-1 mb-2">
              <button
                onClick={() => handlePositionChange(0, 0.6, -1.8)}
                className="py-1 px-1 rounded bg-[#18181b] border border-[#2a2a30] hover:border-amber-500/50 text-[9px] text-[#bbb] hover:text-amber-300 transition-colors text-center"
              >
                In Front AI
              </button>
              <button
                onClick={() => handlePositionChange(-2.5, 0.6, -2.5)}
                className="py-1 px-1 rounded bg-[#18181b] border border-[#2a2a30] hover:border-amber-500/50 text-[9px] text-[#bbb] hover:text-amber-300 transition-colors text-center"
              >
                Left Flank
              </button>
              <button
                onClick={() => handlePositionChange(2.5, 0.6, -2.5)}
                className="py-1 px-1 rounded bg-[#18181b] border border-[#2a2a30] hover:border-amber-500/50 text-[9px] text-[#bbb] hover:text-amber-300 transition-colors text-center"
              >
                Right Flank
              </button>
              <button
                onClick={() => handlePositionChange(posX, 1.8, posZ)}
                className="py-1 px-1 rounded bg-[#18181b] border border-[#2a2a30] hover:border-amber-500/50 text-[9px] text-[#bbb] hover:text-amber-300 transition-colors text-center"
              >
                Levitate 1.8m
              </button>
            </div>

            {/* X Slider */}
            <div className="flex items-center gap-2 mb-1">
              <span className="w-5 text-[#888] font-mono text-[9px]">X:</span>
              <input
                type="range"
                min="-3.5"
                max="3.5"
                step="0.1"
                value={posX}
                onChange={(e) => handlePositionChange(parseFloat(e.target.value), posY, posZ)}
                className="w-full accent-amber-500 h-1 bg-[#222] rounded-lg cursor-pointer"
              />
              <span className="w-8 text-right font-mono text-[9px] text-[#aaa]">{posX.toFixed(1)}</span>
            </div>

            {/* Y Slider (Height) */}
            <div className="flex items-center gap-2 mb-1">
              <span className="w-5 text-[#888] font-mono text-[9px]">Y:</span>
              <input
                type="range"
                min="0.3"
                max="2.5"
                step="0.1"
                value={posY}
                onChange={(e) => handlePositionChange(posX, parseFloat(e.target.value), posZ)}
                className="w-full accent-emerald-500 h-1 bg-[#222] rounded-lg cursor-pointer"
              />
              <span className="w-8 text-right font-mono text-[9px] text-[#aaa]">{posY.toFixed(1)}</span>
            </div>

            {/* Z Slider (Depth) */}
            <div className="flex items-center gap-2">
              <span className="w-5 text-[#888] font-mono text-[9px]">Z:</span>
              <input
                type="range"
                min="-3.5"
                max="3.5"
                step="0.1"
                value={posZ}
                onChange={(e) => handlePositionChange(posX, posY, parseFloat(e.target.value))}
                className="w-full accent-cyan-500 h-1 bg-[#222] rounded-lg cursor-pointer"
              />
              <span className="w-8 text-right font-mono text-[9px] text-[#aaa]">{posZ.toFixed(1)}</span>
            </div>
          </div>

          {/* Rotate & 3D Orientation Tools */}
          <div className="pt-1 border-t border-[#222]">
            <label className="text-[10px] font-mono uppercase tracking-wider text-[#999] flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1">
                <Compass className="w-3 h-3 text-cyan-400" />
                <span>Rotate & Orientation (Yaw, Pitch, Roll)</span>
              </div>
              <span className="text-[9px] text-cyan-400/90 font-mono">
                [{rotX}°, {rotY}°, {rotZ}°]
              </span>
            </label>

            {/* Quick Rotate Action Buttons */}
            <div className="grid grid-cols-5 gap-1 mb-2">
              <button
                onClick={() => handleRotateDelta('y', 45)}
                className="py-1 px-1 rounded bg-[#18181b] border border-[#2a2a30] hover:border-cyan-500/50 text-[9px] text-[#bbb] hover:text-cyan-300 transition-colors text-center flex items-center justify-center gap-0.5"
                title="Rotate +45° around vertical Y-axis"
              >
                <RotateCw className="w-2.5 h-2.5" />
                <span>+45° Y</span>
              </button>
              <button
                onClick={() => handleRotateDelta('y', 90)}
                className="py-1 px-1 rounded bg-[#18181b] border border-[#2a2a30] hover:border-cyan-500/50 text-[9px] text-[#bbb] hover:text-cyan-300 transition-colors text-center flex items-center justify-center gap-0.5"
                title="Rotate +90° around vertical Y-axis"
              >
                <RotateCw className="w-2.5 h-2.5" />
                <span>+90° Y</span>
              </button>
              <button
                onClick={() => handleRotateDelta('x', 45)}
                className="py-1 px-1 rounded bg-[#18181b] border border-[#2a2a30] hover:border-cyan-500/50 text-[9px] text-[#bbb] hover:text-cyan-300 transition-colors text-center flex items-center justify-center gap-0.5"
                title="Tilt +45° pitch around X-axis"
              >
                <span>Tilt X</span>
              </button>
              <button
                onClick={() => handleRotateDelta('z', 45)}
                className="py-1 px-1 rounded bg-[#18181b] border border-[#2a2a30] hover:border-cyan-500/50 text-[9px] text-[#bbb] hover:text-cyan-300 transition-colors text-center flex items-center justify-center gap-0.5"
                title="Roll +45° around Z-axis"
              >
                <span>Roll Z</span>
              </button>
              <button
                onClick={handleResetRotation}
                className="py-1 px-1 rounded bg-[#18181b] border border-[#2a2a30] hover:border-rose-500/50 text-[9px] text-[#bbb] hover:text-rose-300 transition-colors text-center flex items-center justify-center gap-0.5"
                title="Reset all rotation axes to 0°"
              >
                <RefreshCw className="w-2.5 h-2.5" />
                <span>Reset</span>
              </button>
            </div>

            {/* Yaw Slider (Y-Axis) */}
            <div className="flex items-center gap-2 mb-1">
              <span className="w-12 text-[#888] font-mono text-[9px]">Yaw (Y):</span>
              <input
                type="range"
                min="0"
                max="360"
                step="5"
                value={((rotY % 360) + 360) % 360}
                onChange={(e) => handleRotationChange(rotX, parseInt(e.target.value, 10), rotZ)}
                className="w-full accent-cyan-500 h-1 bg-[#222] rounded-lg cursor-pointer"
              />
              <span className="w-8 text-right font-mono text-[9px] text-[#aaa]">
                {((rotY % 360) + 360) % 360}°
              </span>
            </div>

            {/* Pitch Slider (X-Axis) */}
            <div className="flex items-center gap-2 mb-1">
              <span className="w-12 text-[#888] font-mono text-[9px]">Pitch (X):</span>
              <input
                type="range"
                min="-180"
                max="180"
                step="5"
                value={rotX}
                onChange={(e) => handleRotationChange(parseInt(e.target.value, 10), rotY, rotZ)}
                className="w-full accent-purple-500 h-1 bg-[#222] rounded-lg cursor-pointer"
              />
              <span className="w-8 text-right font-mono text-[9px] text-[#aaa]">{rotX}°</span>
            </div>

            {/* Roll Slider (Z-Axis) */}
            <div className="flex items-center gap-2">
              <span className="w-12 text-[#888] font-mono text-[9px]">Roll (Z):</span>
              <input
                type="range"
                min="-180"
                max="180"
                step="5"
                value={rotZ}
                onChange={(e) => handleRotationChange(rotX, rotY, parseInt(e.target.value, 10))}
                className="w-full accent-emerald-500 h-1 bg-[#222] rounded-lg cursor-pointer"
              />
              <span className="w-8 text-right font-mono text-[9px] text-[#aaa]">{rotZ}°</span>
            </div>
          </div>
        </div>
      )}

      {/* Spawn Modal */}
      {isSpawnModalOpen && (
        <div className="mt-3 p-3 bg-[#18181c] border border-[#333] rounded-lg animate-in fade-in">
          <h4 className="font-semibold text-white text-[11px] mb-2 flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5 text-emerald-400" />
            <span>Spawn New Sandbox Entity</span>
          </h4>
          <div className="space-y-2 mb-3">
            <div>
              <label className="text-[9px] text-[#888] font-mono">Entity Name</label>
              <input
                type="text"
                value={newObjName}
                onChange={(e) => setNewObjName(e.target.value)}
                className="w-full bg-[#111] border border-[#333] rounded px-2 py-1 text-white text-xs mt-0.5"
              />
            </div>
            <div>
              <label className="text-[9px] text-[#888] font-mono">Geometry</label>
              <select
                value={newObjShape}
                onChange={(e) => setNewObjShape(e.target.value as any)}
                className="w-full bg-[#111] border border-[#333] rounded px-2 py-1 text-white text-xs mt-0.5"
              >
                <option value="box">Cube / Box</option>
                <option value="sphere">Sphere</option>
                <option value="cylinder">Cylinder</option>
                <option value="cone">Cone</option>
                <option value="torus">Torus Ring</option>
              </select>
            </div>
            <div>
              <label className="text-[9px] text-[#888] font-mono">Spectral Profile</label>
              <select
                value={newObjPreset}
                onChange={(e) => setNewObjPreset(e.target.value)}
                className="w-full bg-[#111] border border-[#333] rounded px-2 py-1 text-white text-xs mt-0.5"
              >
                {SPECTRAL_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setIsSpawnModalOpen(false)}
              className="px-2.5 py-1 rounded bg-[#222] hover:bg-[#333] text-[#aaa] text-[10px]"
            >
              Cancel
            </button>
            <button
              onClick={handleSpawn}
              className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-[10px]"
            >
              Spawn Entity
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
