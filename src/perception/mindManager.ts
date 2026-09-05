/**
 * AI Mind Management & Multisensory Compact Cognitive State Engine
 *
 * Implements:
 * - Compact multisensory representation builder (vision + tactile skin + proprioception + memory)
 * - Zero raw image data, strictly artificial photoreceptor integrations and virtual mechanoreceptors
 * - Zero prescriptive labels (never says "soft", "breakable", or human color words)
 * - Discovered physical consequences & mechanical memory
 * - Anti-loop detection & action suppression
 */

import {
  ArtificialVisionState,
  AgentPose,
  CompactAgentMemory,
  EncounteredFeatureMemory,
  DiscoveredConsequence,
  CognitiveDecision,
  ArtificialTactileState,
  ProprioceptionState,
  ArtificialAuditoryState,
  SensoryToggles,
} from '../types';

export const INITIAL_MEMORY: CompactAgentMemory = {
  exploredGrid: [{ x: 0, z: 0 }],
  encounteredFeatures: [],
  discoveredConsequences: [],
  recentCycles: [],
  consecutiveStationaryCount: 0,
  repeatedActionCount: 0,
  lastActionName: null,
  suppressedActionNotice: null,
};

/**
 * Quantifies the delta between two consecutive multisensory states.
 * Evaluates cone excitation shifts, opponent channel variances, motion index, and tactile contact changes.
 */
export function computeSensoryDelta(
  prevState: ArtificialVisionState | null,
  currState: ArtificialVisionState | null,
  prevTactile?: ArtificialTactileState | null,
  currTactile?: ArtificialTactileState | null
): number {
  if (!prevState || !currState) return 1.0;

  const coneDiff =
    Math.abs((prevState.coneTotals.sRatio || 0) - (currState.coneTotals.sRatio || 0)) +
    Math.abs((prevState.coneTotals.s2Ratio || 0) - (currState.coneTotals.s2Ratio || 0)) +
    Math.abs((prevState.coneTotals.mRatio || 0) - (currState.coneTotals.mRatio || 0)) +
    Math.abs((prevState.coneTotals.m2Ratio || 0) - (currState.coneTotals.m2Ratio || 0)) +
    Math.abs((prevState.coneTotals.lRatio || 0) - (currState.coneTotals.lRatio || 0)) +
    Math.abs((prevState.coneTotals.uvRatio || 0) - (currState.coneTotals.uvRatio || 0)) +
    Math.abs((prevState.coneTotals.nirRatio || 0) - (currState.coneTotals.nirRatio || 0));

  const motionIndex = currState.temporalChangeIndex;

  // Compare salient regions count & bearings
  const prevCount = prevState.salientRegions.length;
  const currCount = currState.salientRegions.length;
  const countDiff = Math.abs(prevCount - currCount) * 0.2;

  let bearingDiff = 0;
  if (prevCount > 0 && currCount > 0) {
    bearingDiff =
      Math.abs(
        prevState.salientRegions[0].azimuthDeg - currState.salientRegions[0].azimuthDeg
      ) / 30.0;
  }

  // Tactile delta
  let tactileDiff = 0;
  if (prevTactile && currTactile) {
    const contactDiff = prevTactile.hasContact !== currTactile.hasContact ? 0.35 : 0;
    const forceDiff =
      Math.abs(prevTactile.totalNormalForceN - currTactile.totalNormalForceN) / 25.0;
    const impactDiff = currTactile.recentImpactSpike ? 0.4 : 0;
    tactileDiff = contactDiff + forceDiff + impactDiff;
  }

  const totalDelta =
    (coneDiff * 1.2 + motionIndex * 1.5 + countDiff + bearingDiff + tactileDiff * 1.5) / 4.5;
  return Math.min(1.0, Math.max(0.0, totalDelta));
}

/**
 * Builds a compact, structured multisensory payload for Gemini
 * Contains NO human color words, NO raw pixel arrays, and NO prescribed semantic labels.
 */
export function buildCompactSensoryPayload(
  visionState: ArtificialVisionState,
  pose: AgentPose,
  tactileState: ArtificialTactileState,
  proprioState: ProprioceptionState,
  memory: CompactAgentMemory,
  antiLoopNotice: string | null,
  auditoryState?: ArtificialAuditoryState | null,
  sensoryToggles?: SensoryToggles | null
) {
  // Mean opponent channels
  const meanLM =
    visionState.opponentLMMap.reduce((a, b) => a + b, 0) /
    (visionState.opponentLMMap.length || 1);
  const meanSLM =
    visionState.opponentSLMMap.reduce((a, b) => a + b, 0) /
    (visionState.opponentSLMMap.length || 1);
  const meanLum =
    visionState.luminanceMap.reduce((a, b) => a + b, 0) /
    (visionState.luminanceMap.length || 1);

  // Compact salient proto-regions from the 32x32 artificial retina
  const compactRegions = visionState.salientRegions.slice(0, 6).map((reg) => ({
    id: reg.id,
    azimuth_bearing_deg: Math.round(reg.azimuthDeg),
    elevation_bearing_deg: Math.round(reg.elevationDeg),
    angular_span_deg: Math.round(reg.angularSpanDeg),
    angular_dimensions_deg: `${reg.angularWidthDeg || Math.round(reg.angularSpanDeg)}°W x ${reg.angularHeightDeg || Math.round(reg.angularSpanDeg)}°H`,
    aspect_ratio_W_over_H: reg.aspectRatio || 1.0,
    silhouette_fill_ratio: reg.fillRatio || 0.8,
    central_void_detected: !!reg.hasCenterVoid,
    morphological_silhouette: reg.shapeMorphology || 'convex silhouette',
    is_centered_in_fovea: !!reg.isFoveal,
    relative_luminance: Number(reg.avgLuminance.toFixed(2)),
    spectral_profile:
      reg.avgOpponent1_LM > 0.15
        ? 'Long-wave dominant (positive L-M)'
        : reg.avgOpponent1_LM < -0.15
        ? 'Medium-wave dominant (negative L-M)'
        : reg.avgOpponent2_S_LM > 0.15
        ? 'Short-wave dominant (positive S-LM)'
        : reg.avgLuminance > 0.6
        ? 'Broadband high-reflectance neutral'
        : 'Neutral low-reflectance',
    opponent_metrics: {
      lm: Number(reg.avgOpponent1_LM.toFixed(3)),
      slm: Number(reg.avgOpponent2_S_LM.toFixed(3)),
    },
    distance_estimate_m: reg.estimatedDistance || 2.5,
  }));

  // Coarse 4x4 spatial pooled receptive fields
  const spatial4x4 = visionState.spatialSummary4x4.map((cell) => ({
    coord: `[${cell.x},${cell.y}]`,
    lum: Number(cell.lum.toFixed(2)),
    lm: Number(cell.op1_LM.toFixed(2)),
    slm: Number(cell.op2_SLM.toFixed(2)),
  }));

  // High-density Central Foveal 4x4 Receptive Fields (center 37.5 deg gaze)
  const centralFovea4x4 = (visionState.fovealSummary4x4 || []).map((c) => ({
    foveal_coord: `[${c.x},${c.y}]`,
    lum: c.lum,
    lm: c.op1_LM,
    slm: c.op2_SLM,
    edge_contrast: c.edgeDensity,
  }));

  // Structured 8x8 Visual Field: Occupied sectors with boundary or spectral contrast
  const occupied8x8Sectors = (visionState.spatialGrid8x8 || [])
    .filter((s) => s.isOccupied)
    .map((s) => ({
      sector: `[${s.x},${s.y}]`,
      lum: s.lum,
      lm: s.op1_LM,
      slm: s.op2_SLM,
      edge: s.edgeDensity,
    }));

  // Compact memory summary
  const memorySummary = {
    total_grid_locations_explored: memory.exploredGrid.length,
    investigated_features_count: memory.encounteredFeatures.length,
    consecutive_stationary_cycles: memory.consecutiveStationaryCount,
    discovered_physical_consequences: memory.discoveredConsequences.slice(-5).map((c) => ({
      cycle: c.cycleLearned,
      action: c.actionUsed,
      applied_force: c.appliedForceLevel,
      outcome: c.sensoryOutcome,
      inferred_property: c.discoveredProperty,
    })),
    previously_discovered_features: memory.encounteredFeatures.slice(-5).map((f) => ({
      feature_id: f.id,
      spectral_type: f.spectralCharacteristics,
      times_investigated: f.investigationCount,
    })),
  };

  // Recent 3 decision summaries
  const recentHistory = memory.recentCycles.slice(-3).map((c) => ({
    cycle: c.cycle,
    intention: c.intention,
    action: c.actionDescription,
    decision_summary: c.decisionSummary,
    sensory_delta: Number(c.sensoryDelta.toFixed(3)),
  }));

  return {
    visual_sensors: {
      retina_spec: '128x128 receptive receptors (16384 total), 7 spectral channels, 64x64 central fovea',
      seven_cone_system_active: visionState.sevenConeVisionActive !== false,
      edge_contrast_density: visionState.edgeContrastDensity || 0.12,
      spatial_variance: visionState.spatialVariance || 0.06,
      cone_excitations: {
        uv_ultraviolet: Number((visionState.coneTotals.uvTotal || 0).toFixed(2)),
        s_short_visible: Number(visionState.coneTotals.sTotal.toFixed(2)),
        s2_short_violet: Number((visionState.coneTotals.s2Total || 0).toFixed(2)),
        m_medium_visible: Number(visionState.coneTotals.mTotal.toFixed(2)),
        m2_green_yellow: Number((visionState.coneTotals.m2Total || 0).toFixed(2)),
        l_long_visible: Number(visionState.coneTotals.lTotal.toFixed(2)),
        nir_near_infrared: Number((visionState.coneTotals.nirTotal || 0).toFixed(2)),
      },
      cone_ratios: {
        uv_fraction: Number((visionState.coneTotals.uvRatio || 0).toFixed(3)),
        s_fraction: Number(visionState.coneTotals.sRatio.toFixed(3)),
        s2_fraction: Number((visionState.coneTotals.s2Ratio || 0).toFixed(3)),
        m_fraction: Number(visionState.coneTotals.mRatio.toFixed(3)),
        m2_fraction: Number((visionState.coneTotals.m2Ratio || 0).toFixed(3)),
        l_fraction: Number(visionState.coneTotals.lRatio.toFixed(3)),
        nir_fraction: Number((visionState.coneTotals.nirRatio || 0).toFixed(3)),
      },
      thermal_average_radiance: Number((visionState.coneTotals.thermalTotal || 0).toFixed(2)),
      opponent_averages: {
        lm_differential: Number(meanLM.toFixed(3)),
        slm_differential: Number(meanSLM.toFixed(3)),
        achromatic_luminance: Number(meanLum.toFixed(3)),
      },
      temporal_dynamics: {
        motion_index: Number(visionState.temporalChangeIndex.toFixed(3)),
        brightness_delta: Number((visionState.brightnessChangeIndex || 0).toFixed(3)),
        spectral_composition_delta: Number((visionState.spectralCompositionDelta || 0).toFixed(3)),
        history_ring_buffer: (visionState.temporalHistory || []).slice(-5),
      },
      salient_proto_regions: compactRegions,
      central_fovea_receptive_fields: centralFovea4x4,
      structured_8x8_occupied_sectors: occupied8x8Sectors,
      spatial_4x4_summary: spatial4x4,
    },
    auditory_sensors: {
      hearing_enabled: auditoryState ? auditoryState.enabled : true,
      hearing_channel_status: (auditoryState ? auditoryState.enabled : true)
        ? "ACTIVE AND LISTENING (16 ERB cochlear filterbank operational)"
        : "DEACTIVATED BY TOGGLE",
      acoustic_environment: (auditoryState?.activeAcousticSources?.length || 0) > 0
        ? `ACOUSTIC SOURCES DETECTED (${auditoryState?.activeAcousticSources.length} active source(s))`
        : "AMBIENT SILENCE (Chamber acoustic noise floor ~30dB SPL)",
      spl_db_left: auditoryState ? Number((auditoryState.leftCochlea.reduce((a, b) => a + b, 0) * 12 + 30).toFixed(1)) : 30.0,
      spl_db_right: auditoryState ? Number((auditoryState.rightCochlea.reduce((a, b) => a + b, 0) * 12 + 30).toFixed(1)) : 30.0,
      binaural_itd_microseconds: auditoryState ? Number(auditoryState.interauralTimeDiff_us.toFixed(0)) : 0,
      binaural_ild_db: auditoryState ? Number(auditoryState.interauralLevelDiff_dB.toFixed(1)) : 0,
      dominant_frequency_hz: auditoryState ? Math.round(auditoryState.dominantFrequencyHz) : 0,
      spectral_centroid_hz: auditoryState ? Math.round(auditoryState.spectralCentroidHz) : 0,
      transient_impact_spike: auditoryState ? auditoryState.onsetTransientDetected : false,
      cochlear_hair_cell_channels: auditoryState ? auditoryState.leftCochlea.map((l, i) => ({
        band: i + 1,
        left_firing: Number(l.toFixed(2)),
        right_firing: Number((auditoryState.rightCochlea[i] || 0).toFixed(2)),
      })) : [],
      active_acoustic_sources_count: auditoryState?.activeAcousticSources?.length || 0,
    },
    tactile_sensors: {
      has_physical_contact: tactileState.hasContact,
      active_receptor_zones: tactileState.contactRegions,
      normal_compression_force_N: tactileState.totalNormalForceN,
      tangential_shear_force_N: tactileState.totalShearForceN,
      indentation_deformation_mm: tactileState.maxDeformationMm,
      texture_vibration_hz: tactileState.dominantVibrationHz,
      vibration_energy: tactileState.meanVibrationEnergy,
      slip_risk_index: tactileState.slipRisk,
      surface_roughness_index: tactileState.surfaceRoughnessEstimate,
      grip_stability_score: tactileState.gripStability,
      mechanical_impact_spike: tactileState.recentImpactSpike,
      distance_to_nearest_surface_m: tactileState.activeObjectDistanceM,
    },
    proprioception_sensors: {
      body_is_moving: proprioState.isMoving,
      chassis_position: proprioState.bodyPosition || [Number(pose.x.toFixed(2)), Number(pose.y.toFixed(2)), Number(pose.z.toFixed(2))],
      chassis_yaw_heading_deg: proprioState.chassisYawDeg ?? Number(pose.yaw.toFixed(1)),
      body_linear_velocity_mps: proprioState.bodyLinearVelocityMps || [0, 0, 0],
      body_angular_velocity_deg_ps: proprioState.bodyAngularVelocityDegPs || 0,
      head_neck: proprioState.head ? {
        neck_yaw_relative_deg: proprioState.head.neckYawDeg,
        neck_pitch_deg: proprioState.head.neckPitchDeg,
        neck_yaw_velocity_deg_ps: proprioState.head.neckYawVelocityDegPs,
        neck_pitch_velocity_deg_ps: proprioState.head.neckPitchVelocityDegPs,
        neck_yaw_target_deg: proprioState.head.neckYawTargetDeg,
        neck_pitch_target_deg: proprioState.head.neckPitchTargetDeg,
      } : {
        neck_yaw_relative_deg: 0,
        neck_pitch_deg: Number(pose.pitch.toFixed(1)),
      },
      wheels: proprioState.wheels || null,
      arm_extension_ratio: proprioState.armExtensionRatio,
      wrist_position_rel_torso: proprioState.wristRelativePosition,
      wrist_rotation_deg: proprioState.wristRotationDeg,
      hand_aperture_m: proprioState.handApertureM,
      finger_flexion_deg: proprioState.fingerFlexionDeg,
      is_gripping_object: proprioState.isGripping,
      held_object_id: proprioState.heldObjectId,
      kinesthetic_load_resistance: proprioState.payloadMassResistance,
      reaches_empty_space: proprioState.isReachingTarget && !tactileState.hasContact,
    },
    sensory_toggles: sensoryToggles || null,
    body_state: {
      position: [
        Number(pose.x.toFixed(2)),
        Number(pose.y.toFixed(2)),
        Number(pose.z.toFixed(2)),
      ],
      yaw_deg: Number(pose.yaw.toFixed(1)),
      pitch_deg: Number(pose.pitch.toFixed(1)),
    },
    recent_history: recentHistory,
    memory: memorySummary,
    anti_loop_notice: antiLoopNotice,
  };
}

/**
 * Updates agent memory with the latest cycle outcomes and learned physical consequences
 */
export function updateAgentMemory(
  prevMemory: CompactAgentMemory,
  pose: AgentPose,
  visionState: ArtificialVisionState,
  decision: CognitiveDecision,
  sensoryDelta: number,
  cycleNumber: number,
  actionResultText?: string
): { updatedMemory: CompactAgentMemory; antiLoopNotice: string | null } {
  // 1. Update explored grid coordinates (quantized to 0.5m)
  const gridX = Math.round(pose.x * 2) / 2;
  const gridZ = Math.round(pose.z * 2) / 2;
  const gridExists = prevMemory.exploredGrid.some(
    (g) => Math.abs(g.x - gridX) < 0.25 && Math.abs(g.z - gridZ) < 0.25
  );
  const updatedGrid = gridExists
    ? prevMemory.exploredGrid
    : [...prevMemory.exploredGrid, { x: gridX, z: gridZ }];

  // 2. Track investigated salient features
  const updatedFeatures: EncounteredFeatureMemory[] = [...prevMemory.encounteredFeatures];
  visionState.salientRegions.forEach((reg) => {
    const specDesc =
      reg.avgOpponent1_LM > 0.15
        ? 'Long-wave dominant (L-M+)'
        : reg.avgOpponent1_LM < -0.15
        ? 'Medium-wave dominant (L-M-)'
        : reg.avgOpponent2_S_LM > 0.15
        ? 'Short-wave dominant (S-LM+)'
        : reg.avgLuminance > 0.6
        ? 'High-reflectance neutral'
        : 'Neutral low-reflectance';

    const existingIdx = updatedFeatures.findIndex((f) => f.id === reg.id);
    if (existingIdx >= 0) {
      updatedFeatures[existingIdx] = {
        ...updatedFeatures[existingIdx],
        investigationCount: updatedFeatures[existingIdx].investigationCount + 1,
        lastVisitedCycle: cycleNumber,
      };
    } else {
      const rad = ((pose.yaw + reg.azimuthDeg) * Math.PI) / 180;
      const dist = reg.estimatedDistance || 2.0;
      const approxX = pose.x - Math.sin(rad) * dist;
      const approxZ = pose.z - Math.cos(rad) * dist;

      updatedFeatures.push({
        id: reg.id,
        approxPosition: [Number(approxX.toFixed(1)), Number(approxZ.toFixed(1))],
        spectralCharacteristics: specDesc,
        investigationCount: 1,
        lastVisitedCycle: cycleNumber,
      });
    }
  });

  // 3. Track physical consequences (e.g. fractures, deformation, immovable load)
  const updatedConsequences: DiscoveredConsequence[] = [...prevMemory.discoveredConsequences];
  if (actionResultText) {
    if (actionResultText.includes('FRACTURE') || actionResultText.includes('fractured')) {
      updatedConsequences.push({
        id: `consequence_fracture_${cycleNumber}`,
        cycleLearned: cycleNumber,
        approxPosition: [Number(pose.x.toFixed(1)), Number(pose.z.toFixed(1))],
        actionUsed: decision.chosen_action,
        appliedForceLevel: 'High Compressive Force (>35N)',
        sensoryOutcome: 'Catastrophic fragmentation into 3 persistent polyhedral shards with high-frequency tactile shock spike',
        discoveredProperty: 'Brittle fracture behavior under high compressive yield',
      });
    } else if (actionResultText.includes('deformation reached')) {
      updatedConsequences.push({
        id: `consequence_compliance_${cycleNumber}`,
        cycleLearned: cycleNumber,
        approxPosition: [Number(pose.x.toFixed(1)), Number(pose.z.toFixed(1))],
        actionUsed: decision.chosen_action,
        appliedForceLevel: 'Moderate Force (15-30N)',
        sensoryOutcome: 'High indentation deformation with elastic recovery',
        discoveredProperty: 'Compliant elastic mechanical property',
      });
    } else if (actionResultText.includes('Kinesthetic overload') || actionResultText.includes('immovable')) {
      updatedConsequences.push({
        id: `consequence_immovable_${cycleNumber}`,
        cycleLearned: cycleNumber,
        approxPosition: [Number(pose.x.toFixed(1)), Number(pose.z.toFixed(1))],
        actionUsed: decision.chosen_action,
        appliedForceLevel: 'Maximum Lift Effort',
        sensoryOutcome: 'Arm motor stalled against massive fixture',
        discoveredProperty: 'Immovable structural foundation',
      });
    }
  }

  // 4. Track action repetition and stationary count
  const isStationaryAction = decision.chosen_action === 'stay';
  const newStationaryCount = isStationaryAction
    ? prevMemory.consecutiveStationaryCount + 1
    : 0;

  const actionKey = `${decision.chosen_action}_${JSON.stringify(decision.action_arguments || {})}`;
  const isSameAction = prevMemory.lastActionName === actionKey;
  const newRepeatedCount = isSameAction ? prevMemory.repeatedActionCount + 1 : 1;

  // 5. Anti-loop detection:
  let antiLoopNotice: string | null = null;
  if (newRepeatedCount >= 2 && sensoryDelta < 0.04 && !isStationaryAction) {
    antiLoopNotice = `NOTICE: Action '${decision.chosen_action}' was executed multiple times with negligible sensory change (delta: ${sensoryDelta.toFixed(3)}). Action '${decision.chosen_action}' is suppressed for the next cycle. Try a different physical interaction (reach, grasp, squeeze, poke, stroke_surface) or explore a new bearing.`;
  }

  // 6. Append cycle history
  const actionSummaryText = formatActionSummary(decision.chosen_action, decision.action_arguments);
  const newCycleEntry = {
    cycle: cycleNumber,
    intention: decision.intention,
    actionDescription: actionSummaryText,
    observationSummary: decision.observation_summary,
    decisionSummary: decision.decision_summary,
    sensoryDelta,
    wasEffective: sensoryDelta > 0.05,
  };

  const updatedCycles = [...prevMemory.recentCycles.slice(-7), newCycleEntry];

  const updatedMemory: CompactAgentMemory = {
    exploredGrid: updatedGrid,
    encounteredFeatures: updatedFeatures.slice(-15),
    discoveredConsequences: updatedConsequences.slice(-10),
    recentCycles: updatedCycles,
    consecutiveStationaryCount: newStationaryCount,
    repeatedActionCount: newRepeatedCount,
    lastActionName: actionKey,
    suppressedActionNotice: antiLoopNotice,
  };

  return { updatedMemory, antiLoopNotice };
}

/**
 * Formats an action into a clean readable label
 */
export function formatActionSummary(action: string, args: Record<string, any>): string {
  switch (action) {
    case 'stay':
      return 'STAY (Observing scene)';
    case 'turn':
      const angle = args.angle_degrees || 0;
      return `TURN ${angle > 0 ? `+${angle}` : angle}°`;
    case 'look':
      return `LOOK ${args.direction || 'center'} (${args.angle_degrees || 15}°)`;
    case 'move_forward':
      return `MOVE FORWARD ${(args.distance || 0.5).toFixed(1)}m`;
    case 'move_backward':
      return `MOVE BACKWARD ${(args.distance || 0.5).toFixed(1)}m`;
    case 'move_left':
      return `STRAFE LEFT ${(args.distance || 0.5).toFixed(1)}m`;
    case 'move_right':
      return `STRAFE RIGHT ${(args.distance || 0.5).toFixed(1)}m`;
    case 'reach':
      return `REACH (${args.objectId || args.target || 'front'})`;
    case 'grasp':
      return `GRASP (${args.objectId || args.target || 'target'})`;
    case 'release':
      return 'RELEASE GRIP';
    case 'squeeze':
      return `SQUEEZE (${args.force_magnitude_n || 40}N force)`;
    case 'lift':
      return 'LIFT PAYLOAD (+0.35m)';
    case 'push':
      return `PUSH (${args.objectId || 'target'})`;
    case 'pull':
      return `PULL (${args.objectId || 'target'})`;
    case 'poke':
      return `POKE (${args.objectId || 'surface'})`;
    case 'stroke_surface':
      return `STROKE SURFACE (${args.objectId || 'target'})`;
    case 'rotate_held_object':
      return 'ROTATE HELD OBJECT (+90°)';
    case 'inspect_held_object':
      return 'INSPECT HELD OBJECT (Close-up Eye)';
    case 'interact':
      return `INTERACT (${args.objectId || args.target || 'surface'})`;
    default:
      return action.toUpperCase();
  }
}
