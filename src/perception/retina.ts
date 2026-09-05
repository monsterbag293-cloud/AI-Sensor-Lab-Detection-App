/**
 * Artificial Retina Processing Layer
 *
 * Implements:
 * - Spatial photoreceptor receptive field grid (128x128 = 16,384 receptors)
 * - Foveal high-density receptive fields (64x64 center)
 * - Local luminance / contrast processing
 * - Center-surround spatial filtering & boundary extraction (Difference of Gaussians)
 * - L-M opponent signal (parvocellular pathway analog)
 * - S-(L+M) opponent signal (koniocellular pathway analog)
 * - Luminance signal (magnocellular pathway analog)
 * - Optional Ultraviolet (UV) photoreceptor channel
 * - Optional Near-Infrared (NIR) & Thermal Infrared channels
 * - Spatial pooling into 8x8 structural grid and 4x4 foveal grid
 * - Temporal motion / change index
 * - Morphological proto-region feature extraction
 */

import {
  ArtificialVisionState,
  VisualProtoRegion
} from '../types';

export const RETINA_RES = 128;
export const TOTAL_RECEPTORS = RETINA_RES * RETINA_RES; // 16384
export const FOVEAL_RES = 64; // Central 64x64 foveal receptive field (37.5 deg)

export interface RawRetinaFrame {
  sMap: Float32Array; // length 16384
  s2Map?: Float32Array; // length 16384
  mMap: Float32Array; // length 16384
  m2Map?: Float32Array; // length 16384
  lMap: Float32Array; // length 16384
  distanceMap: Float32Array; // depth in meters for each receptive field
  uvMap?: Float32Array; // length 16384
  nirMap?: Float32Array; // length 16384
  thermalMap?: Float32Array; // length 16384
  sevenConeEnabled?: boolean;
  uvEnabled?: boolean;
  irEnabled?: boolean;
}

export class ArtificialRetinaProcessor {
  private previousLuminance: Float32Array | null = null;
  private previousConeRatios: number[] | null = null;
  private temporalHistoryBuffer: Array<{
    timestamp: number;
    changeIndex: number;
    brightnessDelta: number;
    spectralDelta: number;
  }> = [];

  /**
   * Process raw 7-cone activations (UV, S, S2, M, M2, L, NIR) and Thermal channels through the retinal neural layer
   */
  public process(
    rawFrame: RawRetinaFrame,
    eyePose: {
      position: [number, number, number];
      yawDegrees: number;
      pitchDegrees: number;
      fovDegrees: number;
    },
    timestamp: number
  ): ArtificialVisionState {
    const sMap = rawFrame.sMap;
    const s2Map = rawFrame.s2Map || sMap;
    const mMap = rawFrame.mMap;
    const m2Map = rawFrame.m2Map || mMap;
    const lMap = rawFrame.lMap;
    const distMap = rawFrame.distanceMap;
    const uvMap = rawFrame.uvMap;
    const nirMap = rawFrame.nirMap;
    const thermalMap = rawFrame.thermalMap;
    const sevenConeEnabled = rawFrame.sevenConeEnabled !== false;
    const uvEnabled = !!rawFrame.uvEnabled;
    const irEnabled = !!rawFrame.irEnabled;

    const luminanceMap = new Float32Array(TOTAL_RECEPTORS);
    const opponentLMMap = new Float32Array(TOTAL_RECEPTORS);
    const opponentSLMMap = new Float32Array(TOTAL_RECEPTORS);
    const opponentS2M2Map = new Float32Array(TOTAL_RECEPTORS);
    const opponentUVVisMap = new Float32Array(TOTAL_RECEPTORS);
    const opponentNIRVisMap = new Float32Array(TOTAL_RECEPTORS);
    const opponentShortLongMap = new Float32Array(TOTAL_RECEPTORS);
    const onCenterMap = new Float32Array(TOTAL_RECEPTORS);
    const offCenterMap = new Float32Array(TOTAL_RECEPTORS);
    const edgeContrastMap = new Float32Array(TOTAL_RECEPTORS);

    let sTotal = 0;
    let s2Total = 0;
    let mTotal = 0;
    let m2Total = 0;
    let lTotal = 0;
    let uvTotal = 0;
    let nirTotal = 0;
    let thermalTotal = 0;

    // 1. Pointwise Opponent, Luminance, and 7-Cone Transformations
    for (let i = 0; i < TOTAL_RECEPTORS; i++) {
      const s = sMap[i];
      const s2 = s2Map[i];
      const m = mMap[i];
      const m2 = m2Map[i];
      const l = lMap[i];
      const uv = uvMap ? uvMap[i] : 0;
      const nir = nirMap ? nirMap[i] : 0;
      const thermal = thermalMap ? thermalMap[i] : 0;

      sTotal += s;
      s2Total += s2;
      mTotal += m;
      m2Total += m2;
      lTotal += l;
      if (uvEnabled) uvTotal += uv;
      if (irEnabled) {
        nirTotal += nir;
        thermalTotal += thermal;
      }

      // Achromatic Luminance channel: weighted sum of visible spectrum
      const lum = 0.2 * l + 0.3 * m2 + 0.3 * m + 0.1 * s2 + 0.1 * s;
      luminanceMap[i] = lum;

      // Opponent Channels:
      // L - M Opponent
      const opLM = (l - m) / (l + m + 0.05);
      opponentLMMap[i] = Math.max(-1, Math.min(1, opLM));

      // S - (L + M)/2 Opponent
      const mlAvg = 0.5 * (l + m);
      const opSLM = (s - mlAvg) / (s + mlAvg + 0.05);
      opponentSLMMap[i] = Math.max(-1, Math.min(1, opSLM));

      // S2 - M2 Opponent
      const opS2M2 = (s2 - m2) / (s2 + m2 + 0.05);
      opponentS2M2Map[i] = Math.max(-1, Math.min(1, opS2M2));

      // UV vs Visible Opponent
      const visAvg = (s + s2 + m + m2 + l) / 5.0;
      const opUVVis = (uv - visAvg) / (uv + visAvg + 0.05);
      opponentUVVisMap[i] = Math.max(-1, Math.min(1, opUVVis));

      // NIR vs Visible Opponent
      const opNIRVis = (nir - visAvg) / (nir + visAvg + 0.05);
      opponentNIRVisMap[i] = Math.max(-1, Math.min(1, opNIRVis));

      // Short-wave (UV+S+S2) vs Long-wave (M+M2+L+NIR) Opponent
      const shortWaveAvg = (uv + s + s2) / 3.0;
      const longWaveAvg = (m + m2 + l + nir) / 4.0;
      const opShortLong = (shortWaveAvg - longWaveAvg) / (shortWaveAvg + longWaveAvg + 0.05);
      opponentShortLongMap[i] = Math.max(-1, Math.min(1, opShortLong));
    }

    // 2. Dual-Pathway Center-Surround ON/OFF & Boundary Filter
    let totalEdgeContrast = 0;

    for (let r = 0; r < RETINA_RES; r++) {
      for (let c = 0; c < RETINA_RES; c++) {
        const idx = r * RETINA_RES + c;
        const centerLum = luminanceMap[idx];
        const centerDist = distMap[idx];
        const centerLM = opponentLMMap[idx];
        const centerS2M2 = opponentS2M2Map[idx];

        let surroundLumSum = 0;
        let surroundLMSum = 0;
        let surroundS2M2Sum = 0;
        let depthDiscontinuity = 0;
        let count = 0;

        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const nr = r + dr;
            const nc = c + dc;
            if (nr >= 0 && nr < RETINA_RES && nc >= 0 && nc < RETINA_RES) {
              const nIdx = nr * RETINA_RES + nc;
              surroundLumSum += luminanceMap[nIdx];
              surroundLMSum += opponentLMMap[nIdx];
              surroundS2M2Sum += opponentS2M2Map[nIdx];
              const distDelta = Math.abs(distMap[nIdx] - centerDist);
              if (distDelta > 0.4) {
                depthDiscontinuity = Math.max(depthDiscontinuity, Math.min(1.0, distDelta / 2.0));
              }
              count++;
            }
          }
        }

        const avgSurroundLum = count > 0 ? surroundLumSum / count : centerLum;
        const avgSurroundLM = count > 0 ? surroundLMSum / count : centerLM;
        const avgSurroundS2M2 = count > 0 ? surroundS2M2Sum / count : centerS2M2;

        // ON-center and OFF-center receptive field pathways
        onCenterMap[idx] = Math.max(0, Math.min(1, (centerLum - avgSurroundLum) * 2.2));
        offCenterMap[idx] = Math.max(0, Math.min(1, (avgSurroundLum - centerLum) * 2.2));

        const lumContrast = Math.abs(centerLum - avgSurroundLum);
        const chromaticContrast = Math.max(
          Math.abs(centerLM - avgSurroundLM),
          Math.abs(centerS2M2 - avgSurroundS2M2)
        );

        const edgeSignal = Math.max(
          lumContrast * 2.2,
          Math.max(chromaticContrast * 1.8, depthDiscontinuity * 0.9)
        );
        const finalEdge = Math.max(0, Math.min(1, edgeSignal));
        edgeContrastMap[idx] = finalEdge;
        totalEdgeContrast += finalEdge;
      }
    }

    const edgeContrastDensity = totalEdgeContrast / TOTAL_RECEPTORS;

    // Spatial variance calculation
    const meanLum = luminanceMap.reduce((a, b) => a + b, 0) / TOTAL_RECEPTORS;
    let lumVariance = 0;
    for (let i = 0; i < TOTAL_RECEPTORS; i++) {
      lumVariance += (luminanceMap[i] - meanLum) ** 2;
    }
    const spatialVariance = lumVariance / TOTAL_RECEPTORS;

    // 3. Temporal Motion & Spectral Composition History
    const sumAllVisible = uvTotal + sTotal + s2Total + mTotal + m2Total + lTotal + nirTotal || 1;
    const currentRatios = [
      uvTotal / sumAllVisible,
      sTotal / sumAllVisible,
      s2Total / sumAllVisible,
      mTotal / sumAllVisible,
      m2Total / sumAllVisible,
      lTotal / sumAllVisible,
      nirTotal / sumAllVisible,
    ];

    let temporalChangeIndex = 0;
    let brightnessChangeIndex = 0;
    let spectralCompositionDelta = 0;

    if (this.previousLuminance && this.previousLuminance.length === TOTAL_RECEPTORS) {
      let diffSum = 0;
      let signedSum = 0;
      for (let i = 0; i < TOTAL_RECEPTORS; i++) {
        const d = luminanceMap[i] - this.previousLuminance[i];
        diffSum += Math.abs(d);
        signedSum += d;
      }
      temporalChangeIndex = diffSum / TOTAL_RECEPTORS;
      brightnessChangeIndex = signedSum / TOTAL_RECEPTORS;
    }

    if (this.previousConeRatios && this.previousConeRatios.length === 7) {
      for (let k = 0; k < 7; k++) {
        spectralCompositionDelta += Math.abs(currentRatios[k] - this.previousConeRatios[k]);
      }
    }

    this.previousLuminance = new Float32Array(luminanceMap);
    this.previousConeRatios = currentRatios;

    // Append to temporal ring buffer
    const frameTemporalMetric = {
      timestamp,
      changeIndex: Number(temporalChangeIndex.toFixed(4)),
      brightnessDelta: Number(brightnessChangeIndex.toFixed(4)),
      spectralDelta: Number(spectralCompositionDelta.toFixed(4)),
    };
    this.temporalHistoryBuffer = [...this.temporalHistoryBuffer.slice(-9), frameTemporalMetric];

    // 4. Structured 8x8 Spatial Grid
    const spatialGrid8x8: Array<{
      x: number;
      y: number;
      lum: number;
      op1_LM: number;
      op2_SLM: number;
      edgeDensity: number;
      isOccupied: boolean;
      uv?: number;
      s2?: number;
      m2?: number;
      nir?: number;
      thermal?: number;
    }> = [];

    const blockSize8 = RETINA_RES / 8;
    for (let by = 0; by < 8; by++) {
      for (let bx = 0; bx < 8; bx++) {
        let bLum = 0;
        let bOpLM = 0;
        let bOpSLM = 0;
        let bS2 = 0;
        let bM2 = 0;
        let bEdge = 0;
        let bUV = 0;
        let bNIR = 0;
        let bThermal = 0;
        let minDepth = 99;
        let samples = 0;

        for (let dy = 0; dy < blockSize8; dy++) {
          for (let dx = 0; dx < blockSize8; dx++) {
            const r = by * blockSize8 + dy;
            const c = bx * blockSize8 + dx;
            const idx = r * RETINA_RES + c;
            bLum += luminanceMap[idx];
            bOpLM += opponentLMMap[idx];
            bOpSLM += opponentSLMMap[idx];
            bS2 += s2Map[idx];
            bM2 += m2Map[idx];
            bEdge += edgeContrastMap[idx];
            if (uvMap && uvEnabled) bUV += uvMap[idx];
            if (nirMap && irEnabled) bNIR += nirMap[idx];
            if (thermalMap && irEnabled) bThermal += thermalMap[idx];
            if (distMap[idx] < minDepth) minDepth = distMap[idx];
            samples++;
          }
        }

        const avgEdge = bEdge / samples;
        const avgLum = bLum / samples;
        const avgOpLM = bOpLM / samples;
        const isOccupied = avgEdge > 0.12 || Math.abs(avgOpLM) > 0.1 || avgLum > 0.55 || minDepth < 4.2;

        spatialGrid8x8.push({
          x: bx,
          y: by,
          lum: Number(avgLum.toFixed(2)),
          op1_LM: Number(avgOpLM.toFixed(2)),
          op2_SLM: Number((bOpSLM / samples).toFixed(2)),
          edgeDensity: Number(avgEdge.toFixed(2)),
          isOccupied,
          uv: uvEnabled ? Number((bUV / samples).toFixed(2)) : undefined,
          s2: Number((bS2 / samples).toFixed(2)),
          m2: Number((bM2 / samples).toFixed(2)),
          nir: irEnabled ? Number((bNIR / samples).toFixed(2)) : undefined,
          thermal: irEnabled ? Number((bThermal / samples).toFixed(2)) : undefined,
        });
      }
    }

    // 5. Central Foveal 4x4 Grid
    const fovealSummary4x4: Array<{
      x: number;
      y: number;
      lum: number;
      op1_LM: number;
      op2_SLM: number;
      edgeDensity: number;
      uv?: number;
      s2?: number;
      m2?: number;
      nir?: number;
      thermal?: number;
    }> = [];

    const fovealStart = (RETINA_RES - FOVEAL_RES) / 2;
    const fovealBlockSize = FOVEAL_RES / 4;

    for (let fy = 0; fy < 4; fy++) {
      for (let fx = 0; fx < 4; fx++) {
        let fLum = 0;
        let fOpLM = 0;
        let fOpSLM = 0;
        let fS2 = 0;
        let fM2 = 0;
        let fEdge = 0;
        let fUV = 0;
        let fNIR = 0;
        let fThermal = 0;
        let samples = 0;

        for (let dy = 0; dy < fovealBlockSize; dy++) {
          for (let dx = 0; dx < fovealBlockSize; dx++) {
            const r = fovealStart + fy * fovealBlockSize + dy;
            const c = fovealStart + fx * fovealBlockSize + dx;
            const idx = r * RETINA_RES + c;
            fLum += luminanceMap[idx];
            fOpLM += opponentLMMap[idx];
            fOpSLM += opponentSLMMap[idx];
            fS2 += s2Map[idx];
            fM2 += m2Map[idx];
            fEdge += edgeContrastMap[idx];
            if (uvMap && uvEnabled) fUV += uvMap[idx];
            if (nirMap && irEnabled) fNIR += nirMap[idx];
            if (thermalMap && irEnabled) fThermal += thermalMap[idx];
            samples++;
          }
        }

        fovealSummary4x4.push({
          x: fx,
          y: fy,
          lum: Number((fLum / samples).toFixed(2)),
          op1_LM: Number((fOpLM / samples).toFixed(2)),
          op2_SLM: Number((fOpSLM / samples).toFixed(2)),
          edgeDensity: Number((fEdge / samples).toFixed(2)),
          uv: uvEnabled ? Number((fUV / samples).toFixed(2)) : undefined,
          s2: Number((fS2 / samples).toFixed(2)),
          m2: Number((fM2 / samples).toFixed(2)),
          nir: irEnabled ? Number((fNIR / samples).toFixed(2)) : undefined,
          thermal: irEnabled ? Number((fThermal / samples).toFixed(2)) : undefined,
        });
      }
    }

    // 6. Spatial Summary 4x4
    const spatialSummary4x4: Array<{
      x: number;
      y: number;
      lum: number;
      op1_LM: number;
      op2_SLM: number;
      uv?: number;
      s2?: number;
      m2?: number;
      nir?: number;
      thermal?: number;
    }> = [];

    const blockSize4 = RETINA_RES / 4;
    for (let by = 0; by < 4; by++) {
      for (let bx = 0; bx < 4; bx++) {
        let bLum = 0;
        let bOpLM = 0;
        let bOpSLM = 0;
        let bS2 = 0;
        let bM2 = 0;
        let bUV = 0;
        let bNIR = 0;
        let bThermal = 0;
        let samples = 0;

        for (let dy = 0; dy < blockSize4; dy++) {
          for (let dx = 0; dx < blockSize4; dx++) {
            const r = by * blockSize4 + dy;
            const c = bx * blockSize4 + dx;
            const idx = r * RETINA_RES + c;
            bLum += luminanceMap[idx];
            bOpLM += opponentLMMap[idx];
            bOpSLM += opponentSLMMap[idx];
            bS2 += s2Map[idx];
            bM2 += m2Map[idx];
            if (uvMap && uvEnabled) bUV += uvMap[idx];
            if (nirMap && irEnabled) bNIR += nirMap[idx];
            if (thermalMap && irEnabled) bThermal += thermalMap[idx];
            samples++;
          }
        }

        spatialSummary4x4.push({
          x: bx,
          y: by,
          lum: Number((bLum / samples).toFixed(3)),
          op1_LM: Number((bOpLM / samples).toFixed(3)),
          op2_SLM: Number((bOpSLM / samples).toFixed(3)),
          uv: uvEnabled ? Number((bUV / samples).toFixed(3)) : undefined,
          s2: Number((bS2 / samples).toFixed(3)),
          m2: Number((bM2 / samples).toFixed(3)),
          nir: irEnabled ? Number((bNIR / samples).toFixed(3)) : undefined,
          thermal: irEnabled ? Number((bThermal / samples).toFixed(3)) : undefined,
        });
      }
    }

    // 7. Extract Salient Proto-Object Regions
    const salientRegions = this.extractProtoRegions(
      luminanceMap,
      opponentLMMap,
      opponentSLMMap,
      edgeContrastMap,
      sMap,
      s2Map,
      mMap,
      m2Map,
      lMap,
      distMap,
      eyePose.fovDegrees,
      uvMap,
      nirMap,
      thermalMap,
      uvEnabled,
      irEnabled
    );

    return {
      timestamp,
      eyePose,
      gridResolution: RETINA_RES,
      fovealResolution: FOVEAL_RES,
      sevenConeVisionActive: sevenConeEnabled,
      uvEnabled,
      irEnabled,
      coneTotals: {
        uvTotal: uvEnabled ? Number(uvTotal.toFixed(2)) : Number(uvTotal.toFixed(2)),
        sTotal: Number(sTotal.toFixed(2)),
        s2Total: Number(s2Total.toFixed(2)),
        mTotal: Number(mTotal.toFixed(2)),
        m2Total: Number(m2Total.toFixed(2)),
        lTotal: Number(lTotal.toFixed(2)),
        nirTotal: irEnabled ? Number(nirTotal.toFixed(2)) : Number(nirTotal.toFixed(2)),
        thermalTotal: irEnabled ? Number(thermalTotal.toFixed(2)) : Number(thermalTotal.toFixed(2)),
        uvRatio: Number((uvTotal / sumAllVisible).toFixed(3)),
        sRatio: Number((sTotal / sumAllVisible).toFixed(3)),
        s2Ratio: Number((s2Total / sumAllVisible).toFixed(3)),
        mRatio: Number((mTotal / sumAllVisible).toFixed(3)),
        m2Ratio: Number((m2Total / sumAllVisible).toFixed(3)),
        lRatio: Number((lTotal / sumAllVisible).toFixed(3)),
        nirRatio: Number((nirTotal / sumAllVisible).toFixed(3)),
      },
      sMap: Array.from(sMap),
      s2Map: Array.from(s2Map),
      mMap: Array.from(mMap),
      m2Map: Array.from(m2Map),
      lMap: Array.from(lMap),
      luminanceMap: Array.from(luminanceMap),
      opponentLMMap: Array.from(opponentLMMap),
      opponentSLMMap: Array.from(opponentSLMMap),
      opponentS2M2Map: Array.from(opponentS2M2Map),
      opponentUVVisMap: Array.from(opponentUVVisMap),
      opponentNIRVisMap: Array.from(opponentNIRVisMap),
      opponentShortLongMap: Array.from(opponentShortLongMap),
      onCenterMap: Array.from(onCenterMap),
      offCenterMap: Array.from(offCenterMap),
      edgeContrastMap: Array.from(edgeContrastMap),
      uvMap: uvMap ? Array.from(uvMap) : undefined,
      nirMap: nirMap ? Array.from(nirMap) : undefined,
      thermalMap: thermalMap ? Array.from(thermalMap) : undefined,
      temporalChangeIndex: Number(temporalChangeIndex.toFixed(4)),
      brightnessChangeIndex: Number(brightnessChangeIndex.toFixed(4)),
      spectralCompositionDelta: Number(spectralCompositionDelta.toFixed(4)),
      temporalHistory: this.temporalHistoryBuffer,
      spatialGrid8x8,
      fovealSummary4x4,
      edgeContrastDensity: Number(edgeContrastDensity.toFixed(3)),
      spatialVariance: Number(spatialVariance.toFixed(3)),
      spatialSummary4x4,
      salientRegions,
    };
  }

  /**
   * Identifies prominent regions in the visual field through sensory structure:
   * depth discontinuities, spectral opponent differences, luminance contrast, edge sharpness, and UV/IR anomalies.
   */
  private extractProtoRegions(
    lumMap: Float32Array,
    opLMMap: Float32Array,
    opSLMMap: Float32Array,
    edgeMap: Float32Array,
    sMap: Float32Array,
    s2Map: Float32Array,
    mMap: Float32Array,
    m2Map: Float32Array,
    lMap: Float32Array,
    distMap: Float32Array,
    fovDegrees: number,
    uvMap?: Float32Array,
    nirMap?: Float32Array,
    thermalMap?: Float32Array,
    uvEnabled: boolean = false,
    irEnabled: boolean = false
  ): VisualProtoRegion[] {
    const visited = new Uint8Array(TOTAL_RECEPTORS);
    const regions: VisualProtoRegion[] = [];

    const fovHalf = fovDegrees / 2;
    const degPerPixel = fovDegrees / RETINA_RES;

    for (let r = 0; r < RETINA_RES; r++) {
      for (let c = 0; c < RETINA_RES; c++) {
        const idx = r * RETINA_RES + c;
        if (visited[idx]) continue;

        const opLM = opLMMap[idx];
        const opSLM = opSLMMap[idx];
        const lum = lumMap[idx];
        const dist = distMap[idx];
        const edge = edgeMap[idx];

        // Multi-channel foreground segmentation
        const isForegroundDistance = dist < 4.8;
        const isSpectralContrast = Math.abs(opLM - 0.04) > 0.09 || Math.abs(opSLM - (-0.14)) > 0.11;
        const isLumContrast = Math.abs(lum - 0.38) > 0.14;
        const isEdgeContour = edge > 0.18;
        const isUVContrast = uvEnabled && uvMap ? Math.abs(uvMap[idx] - 0.2) > 0.25 : false;
        const isIRContrast = irEnabled && nirMap ? Math.abs(nirMap[idx] - 0.4) > 0.3 : false;

        const isSalient = (isForegroundDistance && (isSpectralContrast || isLumContrast || isEdgeContour || isUVContrast || isIRContrast)) ||
                          (isSpectralContrast && isLumContrast);

        if (!isSalient) {
          visited[idx] = 1;
          continue;
        }

        // Flood fill connected component
        const queue: number[] = [idx];
        visited[idx] = 1;

        let rSum = 0;
        let cSum = 0;
        let pixelCount = 0;
        let lumSum = 0;
        let opLMSum = 0;
        let opSLMSum = 0;
        let sSum = 0;
        let s2Sum = 0;
        let mSum = 0;
        let m2Sum = 0;
        let lSum = 0;
        let uvSum = 0;
        let nirSum = 0;
        let thermalSum = 0;
        let distSum = 0;

        let minR = r;
        let maxR = r;
        let minC = c;
        let maxC = c;

        const rowMinCol: { [key: number]: number } = {};
        const rowMaxCol: { [key: number]: number } = {};

        while (queue.length > 0) {
          const curr = queue.pop()!;
          const currR = Math.floor(curr / RETINA_RES);
          const currC = curr % RETINA_RES;

          rSum += currR;
          cSum += currC;
          pixelCount++;

          if (currR < minR) minR = currR;
          if (currR > maxR) maxR = currR;
          if (currC < minC) minC = currC;
          if (currC > maxC) maxC = currC;

          if (rowMinCol[currR] === undefined || currC < rowMinCol[currR]) rowMinCol[currR] = currC;
          if (rowMaxCol[currR] === undefined || currC > rowMaxCol[currR]) rowMaxCol[currR] = currC;

          lumSum += lumMap[curr];
          opLMSum += opLMMap[curr];
          opSLMSum += opSLMMap[curr];
          sSum += sMap[curr];
          s2Sum += s2Map[curr];
          mSum += mMap[curr];
          m2Sum += m2Map[curr];
          lSum += lMap[curr];
          distSum += distMap[curr];
          if (uvMap && uvEnabled) uvSum += uvMap[curr];
          if (nirMap && irEnabled) nirSum += nirMap[curr];
          if (thermalMap && irEnabled) thermalSum += thermalMap[curr];

          // Check 4 neighbors
          const neighbors = [
            [currR - 1, currC],
            [currR + 1, currC],
            [currR, currC - 1],
            [currR, currC + 1]
          ];

          for (const [nr, nc] of neighbors) {
            if (nr >= 0 && nr < RETINA_RES && nc >= 0 && nc < RETINA_RES) {
              const nIdx = nr * RETINA_RES + nc;
              if (!visited[nIdx]) {
                const nDist = distMap[nIdx];
                const nOpLM = opLMMap[nIdx];
                const nOpSLM = opSLMMap[nIdx];

                const distSimilar = Math.abs(nDist - dist) < 0.65;
                const spectralSimilar = Math.abs(nOpLM - opLM) < 0.28 && Math.abs(nOpSLM - opSLM) < 0.32;

                if (distSimilar && (spectralSimilar || edgeMap[nIdx] > 0.15)) {
                  visited[nIdx] = 1;
                  queue.push(nIdx);
                }
              }
            }
          }
        }

        if (pixelCount >= 3) {
          const avgR = rSum / pixelCount;
          const avgC = cSum / pixelCount;

          const azimuthDeg = (avgC / (RETINA_RES - 1)) * fovDegrees - fovHalf;
          const elevationDeg = fovHalf - (avgR / (RETINA_RES - 1)) * fovDegrees;
          const angularSpanDeg = Math.sqrt(pixelCount) * degPerPixel;

          const widthPx = maxC - minC + 1;
          const heightPx = maxR - minR + 1;
          const angularWidthDeg = Number((widthPx * degPerPixel).toFixed(1));
          const angularHeightDeg = Number((heightPx * degPerPixel).toFixed(1));
          const bboxArea = widthPx * heightPx;
          const fillRatio = Number((pixelCount / Math.max(1, bboxArea)).toFixed(2));
          const aspectRatio = Number((angularWidthDeg / Math.max(0.1, angularHeightDeg)).toFixed(2));

          let hasCenterVoid = false;
          if (widthPx >= 5 && heightPx >= 5) {
            const midR = Math.floor((minR + maxR) / 2);
            const midC = Math.floor((minC + maxC) / 2);
            const centerIdx = midR * RETINA_RES + midC;
            if (distMap[centerIdx] > (distSum / pixelCount) + 0.8) {
              hasCenterVoid = true;
            }
          }

          let isTapered = false;
          if (heightPx >= 4) {
            const topRow = minR + Math.floor(heightPx * 0.2);
            const bottomRow = maxR - Math.floor(heightPx * 0.2);
            const topWidth = (rowMaxCol[topRow] !== undefined && rowMinCol[topRow] !== undefined)
              ? rowMaxCol[topRow] - rowMinCol[topRow] + 1
              : 1;
            const bottomWidth = (rowMaxCol[bottomRow] !== undefined && rowMinCol[bottomRow] !== undefined)
              ? rowMaxCol[bottomRow] - rowMinCol[bottomRow] + 1
              : 1;
            if (bottomWidth >= 3 && topWidth / bottomWidth < 0.48) {
              isTapered = true;
            }
          }

          let shapeMorphology = 'unclassified silhouette';
          if (hasCenterVoid) {
            shapeMorphology = 'annular ring contour with central void';
          } else if (isTapered) {
            shapeMorphology = 'tapered conical contour (narrow apex, wide base)';
          } else if (aspectRatio < 0.72) {
            shapeMorphology = 'columnar cylinder / elongated vertical silhouette';
          } else if (aspectRatio > 1.38) {
            shapeMorphology = 'horizontal slab / elongated bar silhouette';
          } else if (fillRatio > 0.84) {
            shapeMorphology = 'rectilinear block / cube silhouette (high fill ~0.9)';
          } else {
            shapeMorphology = 'compact rounded convex contour (sphere / disc profile)';
          }

          const isFoveal = Math.abs(azimuthDeg) <= 18 && Math.abs(elevationDeg) <= 18;

          const avgS = sSum / pixelCount;
          const avgS2 = s2Sum / pixelCount;
          const avgM = mSum / pixelCount;
          const avgM2 = m2Sum / pixelCount;
          const avgL = lSum / pixelCount;

          regions.push({
            id: `region_${regions.length + 1}`,
            azimuthDeg: Number(azimuthDeg.toFixed(1)),
            elevationDeg: Number(elevationDeg.toFixed(1)),
            angularSpanDeg: Number(angularSpanDeg.toFixed(1)),
            angularWidthDeg,
            angularHeightDeg,
            aspectRatio,
            fillRatio,
            pixelCount,
            hasCenterVoid,
            isFoveal,
            shapeMorphology,
            avgLuminance: Number((lumSum / pixelCount).toFixed(3)),
            avgOpponent1_LM: Number((opLMSum / pixelCount).toFixed(3)),
            avgOpponent2_S_LM: Number((opSLMSum / pixelCount).toFixed(3)),
            avgOpponentS2M2: Number(((avgS2 - avgM2) / (avgS2 + avgM2 + 0.05)).toFixed(3)),
            coneRatio_S_ML: Number((avgS / (avgM + avgL + 0.001)).toFixed(3)),
            coneRatio_L_M: Number((avgL / (avgM + 0.001)).toFixed(3)),
            estimatedDistance: Number((distSum / pixelCount).toFixed(2)),
            avgUV: uvEnabled ? Number((uvSum / pixelCount).toFixed(3)) : undefined,
            avgS2: Number(avgS2.toFixed(3)),
            avgM2: Number(avgM2.toFixed(3)),
            avgNIR: irEnabled ? Number((nirSum / pixelCount).toFixed(3)) : undefined,
            avgThermal: irEnabled ? Number((thermalSum / pixelCount).toFixed(3)) : undefined
          });
        }
      }
    }

    return regions.sort((a, b) => b.angularSpanDeg - a.angularSpanDeg).slice(0, 8);
  }
}
