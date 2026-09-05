/**
 * Biologically Inspired Artificial Tactile Processing Engine
 *
 * Implements:
 * - SA-I (Merkel): slowly adapting pressure, local indentation & deformation
 * - SA-II (Ruffini): directional shear force, skin stretch
 * - RA-I (Meissner): dynamic slip detection, low-frequency flutter
 * - PC (Pacinian): high-frequency micro-texture vibration, impact/fracture transients
 * - Thermoreceptors: rate of temperature transfer
 *
 * Processes physical collision/kinematics into a compact, objective tactile state.
 * Never outputs human labels like "soft", "heavy", or "breakable".
 */

import { ArtificialTactileState, TactileReceptorSignal } from '../types';

export interface PhysicalContactEvent {
  contact: boolean;
  contactPoint: [number, number, number]; // world coordinates
  contactNormal: [number, number, number];
  relativeVelocity: [number, number, number]; // m/s
  normalForceN: number;
  tangentialForceN: number;
  contactRegions: string[]; // e.g. ['palm', 'thumb_tip', 'index_tip', 'middle_tip', 'pinky_tip', 'chassis']
  surfaceRoughness: number; // 0 (mirror smooth) to 1 (coarse abrasive)
  compliance: number; // 0 (rigid diamond) to 1 (highly compliant foam)
  frictionCoeff: number; // 0.1 to 1.0
  thermalDiffusivity: number; // rate of cooling/warming relative to ambient
  isFractureEvent?: boolean;
  isImpactEvent?: boolean;
  distanceM: number;
}

export class ArtificialSkinSystem {
  // Historical state for temporal derivative & slip tracking
  private prevNormalForce: number = 0;
  private prevTangentialVelocity: number = 0;
  private vibrationEnergySmoothed: number = 0;
  private impactDecay: number = 0;

  public processTactileInput(contact: PhysicalContactEvent, dt: number): ArtificialTactileState {
    if (!contact.contact) {
      this.prevNormalForce = 0;
      this.prevTangentialVelocity = 0;
      this.vibrationEnergySmoothed = Math.max(0, this.vibrationEnergySmoothed - dt * 4.0);
      this.impactDecay = Math.max(0, this.impactDecay - dt * 5.0);

      return {
        hasContact: false,
        contactRegions: [],
        totalNormalForceN: 0,
        totalShearForceN: 0,
        maxDeformationMm: 0,
        dominantVibrationHz: 0,
        meanVibrationEnergy: 0,
        slipRisk: 0,
        surfaceRoughnessEstimate: 0,
        gripStability: 1.0,
        thermalFlowRate: 0,
        recentImpactSpike: false,
        activeObjectDistanceM: contact.distanceM,
      };
    }

    // 1. SA-I: Slowly Adapting Indentation / Deformation
    // Hookean/Hertzian contact approximation with object compliance
    const deformationMm = Math.min(
      8.0,
      contact.normalForceN * (0.05 + contact.compliance * 0.18)
    );

    // 2. SA-II: Tangential Force & Skin Stretch
    const shearForceN = contact.tangentialForceN;

    // 3. RA-I: Dynamic Slip Calculation
    // Slip occurs when tangential force exceeds Coulombs friction threshold: F_t > mu * F_n
    const maxFrictionN = Math.max(0.1, contact.normalForceN * contact.frictionCoeff);
    const slipRatio = shearForceN / maxFrictionN;
    const slipRisk = Math.min(1.0, Math.max(0.0, slipRatio));

    // Tangential relative speed across receptor field
    const tangVel = Math.hypot(contact.relativeVelocity[0], contact.relativeVelocity[2]);

    // 4. PC: Pacinian Vibration / Texture Frequency
    // Moving across rough micro-structures produces acoustic oscillation: freq = vel / spatial_wavelength
    let vibrationHz = 0;
    let vibrationAmp = 0;

    if (tangVel > 0.005) {
      // Micro-texture roughness oscillates between 40Hz and 320Hz proportional to speed and roughness
      vibrationHz = Math.min(350, 40 + contact.surfaceRoughness * tangVel * 1200);
      vibrationAmp = Math.min(1.0, (contact.surfaceRoughness * tangVel * 8.0) * (contact.normalForceN > 0.5 ? 1 : 0.2));
    }

    // Sudden fracture or impact event creates high-energy broadband transient
    if (contact.isFractureEvent || contact.isImpactEvent) {
      this.impactDecay = 1.0;
      vibrationHz = 280;
      vibrationAmp = 1.0;
    } else {
      this.impactDecay = Math.max(0, this.impactDecay - dt * 3.5);
    }

    this.vibrationEnergySmoothed =
      this.vibrationEnergySmoothed * 0.8 + (vibrationAmp + this.impactDecay * 0.8) * 0.2;

    // 5. Grip Stability Estimation
    // Stable when normal force is sufficient, slip risk is low, and multiple contact zones engage
    const multiPointBonus = contact.contactRegions.length >= 2 ? 0.3 : 0.0;
    const gripStability = Math.min(
      1.0,
      Math.max(
        0.0,
        (1.0 - slipRisk * 0.7) * (contact.normalForceN > 1.5 ? 0.7 : contact.normalForceN / 2.0) +
          multiPointBonus
      )
    );

    // 6. Thermal sensor
    const thermalFlowRate = Math.min(
      1.0,
      Math.max(-1.0, -contact.thermalDiffusivity * (contact.normalForceN > 0.5 ? 1.0 : 0.4))
    );

    this.prevNormalForce = contact.normalForceN;
    this.prevTangentialVelocity = tangVel;

    return {
      hasContact: true,
      contactRegions: contact.contactRegions,
      totalNormalForceN: Number(contact.normalForceN.toFixed(2)),
      totalShearForceN: Number(shearForceN.toFixed(2)),
      maxDeformationMm: Number(deformationMm.toFixed(2)),
      dominantVibrationHz: Math.round(vibrationHz),
      meanVibrationEnergy: Number(this.vibrationEnergySmoothed.toFixed(3)),
      slipRisk: Number(slipRisk.toFixed(3)),
      surfaceRoughnessEstimate: Number(contact.surfaceRoughness.toFixed(2)),
      gripStability: Number(gripStability.toFixed(2)),
      thermalFlowRate: Number(thermalFlowRate.toFixed(2)),
      recentImpactSpike: this.impactDecay > 0.3,
      activeObjectDistanceM: Number(contact.distanceM.toFixed(2)),
    };
  }
}
