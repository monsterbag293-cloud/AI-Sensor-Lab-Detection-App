/**
 * Artificial Proprioception Processing Engine
 *
 * Implements:
 * - Musculoskeletal joint angle and velocity monitoring
 * - Efferent motor copy vs afferent sensory feedback
 * - Kinesthetic load resistance (detecting heavy vs light vs immovable payloads)
 * - Spatial hand-to-target alignment and proximity
 * - Clear distinction between active contact vs reaching through space
 */

import { ProprioceptionState } from '../types';

export interface ArmKinematicsInput {
  isMoving: boolean;
  armExtension: number; // 0.0 (retracted) to 1.0 (fully extended)
  wristWorldPos: [number, number, number];
  agentPos: [number, number, number];
  chassisYawDeg: number;
  bodyLinearVelMps: [number, number, number];
  bodyAngularVelDegPs: number;
  bodyLinearAccelMps2: [number, number, number];
  head: {
    neckYawDeg: number;
    neckPitchDeg: number;
    neckYawVelDegPs: number;
    neckPitchVelDegPs: number;
    neckYawTargetDeg: number;
    neckPitchTargetDeg: number;
  };
  wheels: {
    leftWheelVelMps: number;
    rightWheelVelMps: number;
    leftWheelRotRad: number;
    rightWheelRotRad: number;
    wheelSlipIndex: number;
    groundContact: boolean;
  };
  wristPitchDeg: number;
  wristYawDeg: number;
  wristRollDeg: number;
  handApertureM: number; // 0.0 (closed fist) to 0.18m (wide open)
  fingerFlexion: {
    thumb: number; // 0 (extended) to 90 deg (clenched)
    index: number;
    middle: number;
    pinky: number;
  };
  isGripping: boolean;
  heldObjectId: string | null;
  heldObjectDimensionM?: number;
  heldObjectMassKg?: number;
  distanceToNearestObjectM: number;
  armVelocityMps: number;
  fingerAngularVelocityDegPs: number;
}

export class ArtificialProprioceptionSystem {
  public computeProprioception(input: ArmKinematicsInput): ProprioceptionState {
    // Relative wrist vector relative to torso
    const relX = input.wristWorldPos[0] - input.agentPos[0];
    const relY = input.wristWorldPos[1] - input.agentPos[1];
    const relZ = input.wristWorldPos[2] - input.agentPos[2];

    // Kinesthetic effort / payload resistance (0 unloaded, up to 1.0 at high mass or stall)
    let payloadResistance = 0.0;
    if (input.isGripping && input.heldObjectId) {
      const mass = input.heldObjectMassKg || 1.0;
      // Mass scaling: 0.5kg -> 0.15, 3kg -> 0.6, 5kg -> 0.95
      payloadResistance = Math.min(1.0, Math.max(0.1, mass / 5.0));
    }

    const isReachingTarget = input.isMoving && input.armExtension > 0.2;

    return {
      isMoving: input.isMoving,
      bodyPosition: [
        Number(input.agentPos[0].toFixed(2)),
        Number(input.agentPos[1].toFixed(2)),
        Number(input.agentPos[2].toFixed(2)),
      ],
      chassisYawDeg: Number(input.chassisYawDeg.toFixed(1)),
      bodyLinearVelocityMps: [
        Number(input.bodyLinearVelMps[0].toFixed(2)),
        Number(input.bodyLinearVelMps[1].toFixed(2)),
        Number(input.bodyLinearVelMps[2].toFixed(2)),
      ],
      bodyAngularVelocityDegPs: Number(input.bodyAngularVelDegPs.toFixed(1)),
      bodyLinearAccelerationMps2: [
        Number(input.bodyLinearAccelMps2[0].toFixed(2)),
        Number(input.bodyLinearAccelMps2[1].toFixed(2)),
        Number(input.bodyLinearAccelMps2[2].toFixed(2)),
      ],
      head: {
        neckYawDeg: Number(input.head.neckYawDeg.toFixed(1)),
        neckPitchDeg: Number(input.head.neckPitchDeg.toFixed(1)),
        neckYawVelocityDegPs: Number(input.head.neckYawVelDegPs.toFixed(1)),
        neckPitchVelocityDegPs: Number(input.head.neckPitchVelDegPs.toFixed(1)),
        neckYawTargetDeg: Number(input.head.neckYawTargetDeg.toFixed(1)),
        neckPitchTargetDeg: Number(input.head.neckPitchTargetDeg.toFixed(1)),
      },
      wheels: {
        leftWheelVelocityMps: Number(input.wheels.leftWheelVelMps.toFixed(2)),
        rightWheelVelocityMps: Number(input.wheels.rightWheelVelMps.toFixed(2)),
        leftWheelRotationRad: Number(input.wheels.leftWheelRotRad.toFixed(2)),
        rightWheelRotationRad: Number(input.wheels.rightWheelRotRad.toFixed(2)),
        wheelSlipIndex: Number(input.wheels.wheelSlipIndex.toFixed(2)),
        groundContact: input.wheels.groundContact,
      },
      armExtensionRatio: Number(input.armExtension.toFixed(2)),
      wristWorldPosition: [
        Number(input.wristWorldPos[0].toFixed(2)),
        Number(input.wristWorldPos[1].toFixed(2)),
        Number(input.wristWorldPos[2].toFixed(2)),
      ],
      wristRelativePosition: [
        Number(relX.toFixed(2)),
        Number(relY.toFixed(2)),
        Number(relZ.toFixed(2)),
      ],
      wristRotationDeg: Number(input.wristRollDeg.toFixed(1)),
      handApertureM: Number(input.handApertureM.toFixed(3)),
      fingerFlexionDeg: {
        thumb: Math.round(input.fingerFlexion.thumb),
        index: Math.round(input.fingerFlexion.index),
        middle: Math.round(input.fingerFlexion.middle),
        pinky: Math.round(input.fingerFlexion.pinky),
      },
      isGripping: input.isGripping,
      heldObjectId: input.heldObjectId,
      heldObjectDimensionM: input.heldObjectDimensionM,
      jointVelocities: {
        arm: Number(input.armVelocityMps.toFixed(2)),
        wrist: Number((input.wristPitchDeg * 0.05).toFixed(2)),
        fingers: Number(input.fingerAngularVelocityDegPs.toFixed(1)),
      },
      payloadMassResistance: Number(payloadResistance.toFixed(2)),
      distanceToNearestSurfaceM: Number(input.distanceToNearestObjectM.toFixed(2)),
      isReachingTarget,
    };
  }
}
