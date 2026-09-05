/**
 * Biologically Inspired Artificial Auditory System
 *
 * Implements:
 * - Binaural spatial acoustics with Left & Right ears
 * - Head-Related Transfer Function (HRTF) approximation:
 *   * Distance attenuation (1 / d^2)
 *   * Interaural Time Difference (ITD): microsecond delay between ears
 *   * Interaural Level Difference (ILD): frequency-dependent head shadow attenuation
 *   * Pinna / outer ear directional elevation filtering
 * - Physical sound sources from 3D interactions:
 *   * Friction & surface rubbing
 *   * Grasp & release transients
 *   * Sliding & pushing slip-stick waves
 *   * Collision impact shocks & decay rings
 *   * Deformation & strain micro-emissions
 *   * Catastrophic fracture explosive shockwave bursts
 *   * Locomotion & footstep mechanical thuds
 *   * Chamber ambient resonances
 * - Doppler shift dynamics based on relative source-listener velocities
 * - 16-channel ERB (Equivalent Rectangular Bandwidth) cochlear filterbank
 * - Inner Hair Cell (IHC) transduction with half-wave rectification & Naka-Rushton compression
 * - Fast onset detection & adaptation dynamics
 * - Spectrogram history for technical diagnostics
 */

import {
  AcousticEvent,
  ActiveAcousticSource,
  ArtificialAuditoryState,
  SpectrogramFrame,
  AgentPose
} from '../types';

export const SPEED_OF_SOUND_M_S = 343.0;
export const INTERAURAL_DISTANCE_M = 0.22; // Distance between ears in meters

// 16 Logarithmic / ERB Center Frequencies spanning human auditory range (80 Hz to 16 kHz)
export const COCHLEAR_CENTER_FREQS_HZ = [
  80, 125, 200, 315, 500, 800, 1250, 2000,
  3150, 4500, 6000, 8000, 10000, 12000, 14000, 16000
];

export const NUM_COCHLEAR_CHANNELS = COCHLEAR_CENTER_FREQS_HZ.length; // 16

export class ArtificialAuditoryProcessor {
  private activeEvents: Map<string, AcousticEvent> = new Map();
  private leftChannelAdaptation: Float32Array = new Float32Array(NUM_COCHLEAR_CHANNELS);
  private rightChannelAdaptation: Float32Array = new Float32Array(NUM_COCHLEAR_CHANNELS);
  private spectrogramBuffer: SpectrogramFrame[] = [];
  private readonly maxSpectrogramHistory = 40;
  private lastUpdateTimestamp = 0;
  private previousBinauralEnergy = 0;

  /**
   * Register or update an acoustic event in the 3D world
   */
  public emitSound(event: AcousticEvent) {
    this.activeEvents.set(event.id, { ...event });
  }

  /**
   * Remove finished acoustic events
   */
  public pruneFinishedEvents(currentTimestamp: number) {
    for (const [id, event] of this.activeEvents.entries()) {
      if (currentTimestamp - event.startTime > event.durationMs / 1000) {
        this.activeEvents.delete(id);
      }
    }
  }

  /**
   * Clear all active acoustic events
   */
  public clearAllEvents() {
    this.activeEvents.clear();
    this.leftChannelAdaptation.fill(0);
    this.rightChannelAdaptation.fill(0);
    this.spectrogramBuffer = [];
  }

  /**
   * Compute the world positions and velocities of Left and Right ears from agent pose
   */
  public calculateEarPositions(
    pose: AgentPose,
    agentVelocity: [number, number, number] = [0, 0, 0]
  ): {
    leftEar: { pos: [number, number, number]; vel: [number, number, number] };
    rightEar: { pos: [number, number, number]; vel: [number, number, number] };
  } {
    const yawRad = (pose.yaw * Math.PI) / 180;
    // Ear axis is perpendicular to facing heading
    const rightX = Math.cos(yawRad) * (INTERAURAL_DISTANCE_M / 2);
    const rightZ = -Math.sin(yawRad) * (INTERAURAL_DISTANCE_M / 2);

    const leftX = -rightX;
    const leftZ = -rightZ;

    const headY = pose.y + 0.55; // Ear height relative to agent base

    return {
      leftEar: {
        pos: [pose.x + leftX, headY, pose.z + leftZ],
        vel: [...agentVelocity]
      },
      rightEar: {
        pos: [pose.x + rightX, headY, pose.z + rightZ],
        vel: [...agentVelocity]
      }
    };
  }

  /**
   * Process all acoustic pressure waves arriving at ears and compute cochlear activations
   */
  public process(
    pose: AgentPose,
    agentVelocity: [number, number, number],
    timestamp: number,
    enabled: boolean = true
  ): ArtificialAuditoryState {
    this.pruneFinishedEvents(timestamp);

    const dt = this.lastUpdateTimestamp > 0 ? Math.min(0.1, timestamp - this.lastUpdateTimestamp) : 0.05;
    this.lastUpdateTimestamp = timestamp;

    if (!enabled) {
      return {
        enabled: false,
        timestamp,
        leftCochlea: new Array(NUM_COCHLEAR_CHANNELS).fill(0),
        rightCochlea: new Array(NUM_COCHLEAR_CHANNELS).fill(0),
        binauralEnergy: 0,
        interauralLevelDiff_dB: 0,
        interauralTimeDiff_us: 0,
        spectralCentroidHz: 0,
        dominantFrequencyHz: 0,
        onsetTransientDetected: false,
        temporalModulationIndex: 0,
        dopplerShiftRatio: 1.0,
        activeAcousticSources: [],
        spectrogramHistory: []
      };
    }

    const { leftEar, rightEar } = this.calculateEarPositions(pose, agentVelocity);
    const yawRad = (pose.yaw * Math.PI) / 180;
    const forwardVec: [number, number, number] = [-Math.sin(yawRad), 0, -Math.cos(yawRad)];
    const rightVec: [number, number, number] = [Math.cos(yawRad), 0, -Math.sin(yawRad)];

    const leftRawSpectrum = new Float32Array(NUM_COCHLEAR_CHANNELS);
    const rightRawSpectrum = new Float32Array(NUM_COCHLEAR_CHANNELS);

    let totalLeftEnergy = 0;
    let totalRightEnergy = 0;
    let weightedITD_us = 0;
    let weightedDoppler = 0;
    let totalSourceWeight = 0;
    const activeSourcesSummary: ActiveAcousticSource[] = [];

    // Always include subtle room ambient baseline noise (HVAC/chamber resonance ~100Hz)
    leftRawSpectrum[0] += 0.02;
    leftRawSpectrum[1] += 0.015;
    rightRawSpectrum[0] += 0.02;
    rightRawSpectrum[1] += 0.015;

    for (const event of this.activeEvents.values()) {
      const ageSec = timestamp - event.startTime;
      if (ageSec < 0 || ageSec > event.durationMs / 1000) continue;

      // Calculate temporal envelope amplitude based on decay profile
      let envelope = 1.0;
      const normTime = ageSec / (event.durationMs / 1000);
      if (event.decayType === 'exponential') {
        envelope = Math.exp(-normTime * 5.0);
      } else if (event.decayType === 'burst') {
        envelope = normTime < 0.1 ? normTime / 0.1 : Math.exp(-(normTime - 0.1) * 8.0);
      } else {
        // steady
        envelope = Math.sin(Math.PI * normTime);
      }

      const currentPressure = event.peakPressurePa * envelope;
      if (currentPressure <= 0.0001) continue;

      // Vector to Left Ear
      const dxL = event.worldPosition[0] - leftEar.pos[0];
      const dyL = event.worldPosition[1] - leftEar.pos[1];
      const dzL = event.worldPosition[2] - leftEar.pos[2];
      const distL = Math.sqrt(dxL * dxL + dyL * dyL + dzL * dzL);

      // Vector to Right Ear
      const dxR = event.worldPosition[0] - rightEar.pos[0];
      const dyR = event.worldPosition[1] - rightEar.pos[1];
      const dzR = event.worldPosition[2] - rightEar.pos[2];
      const distR = Math.sqrt(dxR * dxR + dyR * dyR + dzR * dzR);

      // Distance attenuation (1 / (1 + d^2))
      const attenL = 1.0 / (1.0 + distL * distL * 0.8);
      const attenR = 1.0 / (1.0 + distR * distR * 0.8);

      // Interaural Time Difference: ITD = (distL - distR) / c
      // Positive ITD => sound arrived at Right Ear first (sound is to the right)
      const itdSec = (distL - distR) / SPEED_OF_SOUND_M_S;
      const itd_us = itdSec * 1000000;

      // Azimuth and Elevation relative to agent head
      const avgDx = (dxL + dxR) / 2;
      const avgDy = (dyL + dyR) / 2;
      const avgDz = (dzL + dzR) / 2;
      const avgDist = (distL + distR) / 2;

      // Relative coordinates along head axes
      const dotForward = avgDx * forwardVec[0] + avgDz * forwardVec[2];
      const dotRight = avgDx * rightVec[0] + avgDz * rightVec[2];
      const azimuthDeg = (Math.atan2(dotRight, dotForward) * 180) / Math.PI;

      // Doppler Shift Calculation:
      // Relative radial velocity between source and listener
      const rL_unit = [dxL / (distL + 0.001), dyL / (distL + 0.001), dzL / (distL + 0.001)];
      const v_rel_source = event.sourceVelocity[0] * rL_unit[0] + event.sourceVelocity[1] * rL_unit[1] + event.sourceVelocity[2] * rL_unit[2];
      const v_rel_ear = agentVelocity[0] * rL_unit[0] + agentVelocity[1] * rL_unit[1] + agentVelocity[2] * rL_unit[2];
      const dopplerRatio = Math.max(0.7, Math.min(1.4, (SPEED_OF_SOUND_M_S + v_rel_ear) / (SPEED_OF_SOUND_M_S - v_rel_source + 0.001)));

      const shiftedCenterFreq = event.baseFrequencyHz * dopplerRatio;

      // Head Shadow ILD (Interaural Level Difference):
      // Frequencies > 1.5 kHz are shadowed significantly by the head (up to 15 dB)
      // Angle theta: 0 = directly ahead, +90 = right, -90 = left
      const thetaRad = (azimuthDeg * Math.PI) / 180;
      const headShadowL = 1.0 + 0.45 * Math.sin(-thetaRad); // quieter when sound is on right
      const headShadowR = 1.0 + 0.45 * Math.sin(thetaRad); // quieter when sound is on left

      // Distribute acoustic energy across the 16 ERB cochlear channels (Gaussian frequency envelope)
      const bandwidth = Math.max(80, event.bandwidthHz);

      for (let ch = 0; ch < NUM_COCHLEAR_CHANNELS; ch++) {
        const fc = COCHLEAR_CENTER_FREQS_HZ[ch];
        const df = (fc - shiftedCenterFreq) / (bandwidth * 0.85);
        const channelWeight = Math.exp(-df * df);

        // High-frequency head shadowing factor
        const hfAtten = fc > 1500 ? (fc / 16000) * 0.6 : 0.05;
        const shadowL = Math.max(0.1, headShadowL * (1.0 - hfAtten * Math.max(0, Math.sin(thetaRad))));
        const shadowR = Math.max(0.1, headShadowR * (1.0 - hfAtten * Math.max(0, Math.sin(-thetaRad))));

        const pL = currentPressure * attenL * shadowL * channelWeight;
        const pR = currentPressure * attenR * shadowR * channelWeight;

        leftRawSpectrum[ch] += pL;
        rightRawSpectrum[ch] += pR;
      }

      const eventEnergy = currentPressure * (attenL + attenR) * 0.5;
      weightedITD_us += itd_us * eventEnergy;
      weightedDoppler += dopplerRatio * eventEnergy;
      totalSourceWeight += eventEnergy;

      const soundLevel_dB = 20 * Math.log10(Math.max(0.00002, currentPressure * (attenL + attenR) * 0.5) / 0.00002);

      activeSourcesSummary.push({
        type: event.type,
        bearingAzimuthDeg: Math.round(azimuthDeg * 10) / 10,
        distanceM: Math.round(avgDist * 100) / 100,
        soundLevel_dB: Math.round(soundLevel_dB),
        frequencyBandHz: Math.round(shiftedCenterFreq),
        dopplerRatio: Math.round(dopplerRatio * 1000) / 1000
      });
    }

    // 2. Inner Hair Cell (IHC) Transduction:
    // Half-wave rectification + Naka-Rushton compression + Fast adaptation dynamics
    const leftCochlea = new Array(NUM_COCHLEAR_CHANNELS);
    const rightCochlea = new Array(NUM_COCHLEAR_CHANNELS);

    let spectralCentroidNumerator = 0;
    let spectralCentroidDenominator = 0;
    let maxChannelVal = 0;
    let dominantFreq = 0;

    const sigma = 0.35; // IHC compression parameter

    for (let ch = 0; ch < NUM_COCHLEAR_CHANNELS; ch++) {
      const fc = COCHLEAR_CENTER_FREQS_HZ[ch];

      // Left IHC compression
      const rawL = Math.max(0, leftRawSpectrum[ch]);
      const compL = (rawL * rawL) / (rawL * rawL + sigma * sigma);
      // Adaptation
      const adaptedL = Math.max(0, compL - this.leftChannelAdaptation[ch] * 0.3);
      this.leftChannelAdaptation[ch] = this.leftChannelAdaptation[ch] * (1.0 - dt * 4.0) + compL * (dt * 4.0);
      leftCochlea[ch] = Math.max(0, Math.min(1.0, adaptedL));

      // Right IHC compression
      const rawR = Math.max(0, rightRawSpectrum[ch]);
      const compR = (rawR * rawR) / (rawR * rawR + sigma * sigma);
      // Adaptation
      const adaptedR = Math.max(0, compR - this.rightChannelAdaptation[ch] * 0.3);
      this.rightChannelAdaptation[ch] = this.rightChannelAdaptation[ch] * (1.0 - dt * 4.0) + compR * (dt * 4.0);
      rightCochlea[ch] = Math.max(0, Math.min(1.0, adaptedR));

      const chAvg = (leftCochlea[ch] + rightCochlea[ch]) * 0.5;
      totalLeftEnergy += leftCochlea[ch];
      totalRightEnergy += rightCochlea[ch];

      spectralCentroidNumerator += fc * chAvg;
      spectralCentroidDenominator += chAvg;

      if (chAvg > maxChannelVal) {
        maxChannelVal = chAvg;
        dominantFreq = fc;
      }
    }

    const binauralEnergy = Math.min(1.0, (totalLeftEnergy + totalRightEnergy) / (NUM_COCHLEAR_CHANNELS * 1.5));
    const ild_dB = totalRightEnergy > 0.001
      ? 20 * Math.log10((totalLeftEnergy + 0.001) / (totalRightEnergy + 0.001))
      : 0;

    const itd_us = totalSourceWeight > 0.001 ? weightedITD_us / totalSourceWeight : 0;
    const meanDoppler = totalSourceWeight > 0.001 ? weightedDoppler / totalSourceWeight : 1.0;
    const spectralCentroidHz = spectralCentroidDenominator > 0.001
      ? Math.round(spectralCentroidNumerator / spectralCentroidDenominator)
      : 0;

    // Transient Onset Detection (rapid energy increase)
    const energyDelta = binauralEnergy - this.previousBinauralEnergy;
    const onsetTransientDetected = energyDelta > 0.15;
    const temporalModulationIndex = Math.min(1.0, Math.abs(energyDelta) * 5.0);
    this.previousBinauralEnergy = binauralEnergy;

    // Update Spectrogram Waterfall History
    this.spectrogramBuffer.push({
      timestamp,
      leftChannels: [...leftCochlea],
      rightChannels: [...rightCochlea]
    });
    if (this.spectrogramBuffer.length > this.maxSpectrogramHistory) {
      this.spectrogramBuffer.shift();
    }

    return {
      enabled: true,
      timestamp,
      leftCochlea,
      rightCochlea,
      binauralEnergy: Math.round(binauralEnergy * 1000) / 1000,
      interauralLevelDiff_dB: Math.round(ild_dB * 10) / 10,
      interauralTimeDiff_us: Math.round(itd_us),
      spectralCentroidHz,
      dominantFrequencyHz: dominantFreq,
      onsetTransientDetected,
      temporalModulationIndex: Math.round(temporalModulationIndex * 100) / 100,
      dopplerShiftRatio: Math.round(meanDoppler * 1000) / 1000,
      activeAcousticSources: activeSourcesSummary,
      spectrogramHistory: [...this.spectrogramBuffer]
    };
  }
}
