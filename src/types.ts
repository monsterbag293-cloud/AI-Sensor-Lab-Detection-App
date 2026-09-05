/**
 * Types for Artificial Visual Perception Lab
 */

export interface WavelengthSample {
  wavelength: number; // in nanometers (400 to 700)
  value: number; // normalized intensity or reflectance (0 to 1)
}

export interface SpectralDistribution {
  name: string;
  description: string;
  // Discrete spectral samples across 400nm to 700nm at 10nm intervals (31 points)
  samples: number[];
}

export interface ConeSensitivityCurves {
  wavelengths: number[]; // 400, 410, ..., 700
  sCone: number[]; // Short-wavelength cone sensitivity
  mCone: number[]; // Medium-wavelength cone sensitivity
  lCone: number[]; // Long-wavelength cone sensitivity
}

export interface ConeResponse {
  s: number; // 0 to 1
  m: number; // 0 to 1
  l: number; // 0 to 1
}

export interface OpponentSignal {
  // Achromatic luminance: L + M
  luminance: number;
  // Red-Green opponent: L - M (bipolar: -1 to +1)
  opponent1_LM: number;
  // Blue-Yellow opponent: S - (L + M)/2 (bipolar: -1 to +1)
  opponent2_S_LM: number;
  // High-frequency edge/contrast signal from center-surround receptive field
  contrastEdge: number;
}

export interface VisualProtoRegion {
  id: string;
  azimuthDeg: number; // -37.5 to +37.5 degrees relative to eye heading
  elevationDeg: number; // -37.5 to +37.5 degrees
  angularSpanDeg: number; // approximate angular extent in visual field
  angularWidthDeg?: number;
  angularHeightDeg?: number;
  aspectRatio?: number; // width / height
  fillRatio?: number; // pixel count / bounding box area
  pixelCount?: number;
  hasCenterVoid?: boolean; // central void / ring structure
  isFoveal?: boolean; // falls in central fovea
  shapeMorphology?: string; // e.g. "equiaxed block", "columnar cylinder", "tapered cone", "circular disc", "annular ring"
  avgLuminance: number;
  avgOpponent1_LM: number; // L - M
  avgOpponent2_S_LM: number; // S - (L + M)
  avgOpponentS2M2?: number; // S2 - M2
  coneRatio_S_ML: number; // S / (M + L + 0.001)
  coneRatio_L_M: number; // L / (M + 0.001)
  estimatedDistance?: number;
  // Extended Photoreceptor channels (0 to 1)
  avgUV?: number;
  avgS2?: number;
  avgM2?: number;
  avgNIR?: number;
  avgThermal?: number; // Normalized thermal radiation (Kelvin equivalent)
}

export interface ArtificialVisionState {
  timestamp: number;
  eyePose: {
    position: [number, number, number];
    yawDegrees: number;
    pitchDegrees: number;
    fovDegrees: number;
  };
  gridResolution: number; // e.g. 32 for 32x32 receptive field grid
  fovealResolution?: number; // e.g. 16 for central 16x16 fovea
  // Senses active state
  sevenConeVisionActive?: boolean;
  uvEnabled?: boolean;
  irEnabled?: boolean;
  // Aggregated 7-cone responses across the retinal field
  coneTotals: {
    uvTotal?: number;
    sTotal: number;
    s2Total?: number;
    mTotal: number;
    m2Total?: number;
    lTotal: number;
    nirTotal?: number;
    thermalTotal?: number;
    uvRatio?: number;
    sRatio: number;
    s2Ratio?: number;
    mRatio: number;
    m2Ratio?: number;
    lRatio: number;
    nirRatio?: number;
  };
  // 128x128 arrays flattened (length 16384)
  sMap: number[];
  s2Map?: number[];
  mMap: number[];
  m2Map?: number[];
  lMap: number[];
  luminanceMap: number[];
  opponentLMMap: number[];
  opponentSLMMap: number[];
  opponentS2M2Map?: number[];
  opponentUVVisMap?: number[];
  opponentNIRVisMap?: number[];
  opponentShortLongMap?: number[];
  onCenterMap?: number[];
  offCenterMap?: number[];
  edgeContrastMap: number[];
  // Extended spectral maps (length 16384)
  uvMap?: number[];
  nirMap?: number[];
  thermalMap?: number[];
  // Temporal delta & ring buffer history
  temporalChangeIndex: number;
  brightnessChangeIndex?: number;
  spectralCompositionDelta?: number;
  temporalHistory?: Array<{
    timestamp: number;
    changeIndex: number;
    brightnessDelta: number;
    spectralDelta: number;
  }>;
  // Structured 8x8 spatial grid for AI perception (64 sectors with boundary preserving pooling)
  spatialGrid8x8?: Array<{
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
  }>;
  // Central Foveal 4x4 high-density grid covering gaze center
  fovealSummary4x4?: Array<{
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
  }>;
  // Whole-field metrics
  edgeContrastDensity?: number;
  spatialVariance?: number;
  // RGB pixel buffer (32x32 x 4 = 4096 bytes) for real-time visual retina preview
  rgbPixelData?: number[];
  // Backward compatibility: coarse 4x4 spatial pooled sensory summary
  spatialSummary4x4: Array<{
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
  }>;
  // Extracted proto-object salient regions in the field of view
  salientRegions: VisualProtoRegion[];
}

/**
 * Auditory System Types
 */
export interface AcousticEvent {
  id: string;
  sourceId: string;
  type: 'friction' | 'impact' | 'fracture' | 'deformation' | 'sliding' | 'locomotion' | 'grip' | 'ambient';
  worldPosition: [number, number, number];
  sourceVelocity: [number, number, number];
  baseFrequencyHz: number;
  bandwidthHz: number;
  peakPressurePa: number;
  durationMs: number;
  startTime: number;
  decayType: 'exponential' | 'steady' | 'burst';
  roughnessIndex?: number;
}

export interface ActiveAcousticSource {
  type: string;
  bearingAzimuthDeg: number;
  distanceM: number;
  soundLevel_dB: number;
  frequencyBandHz: number;
  dopplerRatio: number;
}

export interface SpectrogramFrame {
  timestamp: number;
  leftChannels: number[];
  rightChannels: number[];
}

export interface ArtificialAuditoryState {
  enabled: boolean;
  timestamp: number;
  // 16-channel cochlear ERB filterbank response [0..1]
  leftCochlea: number[];
  rightCochlea: number[];
  // Binaural localization cues
  binauralEnergy: number; // 0 to 1
  interauralLevelDiff_dB: number; // ILD (positive: louder in Left ear, negative: louder in Right ear)
  interauralTimeDiff_us: number; // ITD in microseconds (-650 to +650 μs)
  spectralCentroidHz: number; // Average frequency weighted by energy
  dominantFrequencyHz: number;
  onsetTransientDetected: boolean;
  temporalModulationIndex: number; // Rate of sound amplitude envelope variation
  dopplerShiftRatio: number; // Overall Doppler frequency scaling factor
  activeAcousticSources: ActiveAcousticSource[];
  spectrogramHistory: SpectrogramFrame[];
}

export interface SensoryToggles {
  vision: boolean;
  sevenConeVision: boolean;
  uvVision: boolean;
  irVision: boolean;
  hearing: boolean;
  tactile: boolean;
  proprioception: boolean;
}

export interface AgentPose {
  x: number;
  y: number;
  z: number;
  yaw: number; // degrees
  pitch: number; // degrees
  fov: number; // degrees
}

export interface WorldObjectInfo {
  id: string;
  name: string;
  shape: 'box' | 'sphere' | 'cylinder' | 'cone' | 'octahedron';
  position: [number, number, number];
  size: [number, number, number];
  materialName: string;
  spectralProfileName: string;
}

export interface LightPreset {
  id: string;
  name: string;
  description: string;
  colorHex: string;
  temperatureKelvin?: number;
}

export type ActionName =
  | 'stay'
  | 'look'
  | 'turn'
  | 'move_forward'
  | 'move_backward'
  | 'move_left'
  | 'move_right'
  | 'reach'
  | 'grasp'
  | 'release'
  | 'squeeze'
  | 'lift'
  | 'push'
  | 'pull'
  | 'poke'
  | 'stroke_surface'
  | 'rotate_held_object'
  | 'inspect_held_object'
  | 'interact'
  | 'wait';

export interface ToolCallPayload {
  name: ActionName;
  args: Record<string, any>;
}

export type ConsciousStatus =
  | 'AWAKE'
  | 'OBSERVING'
  | 'THINKING'
  | 'ACTING'
  | 'WAITING_FOR_USER'
  | 'SLEEPING'
  | 'ERROR'
  | 'QUOTA_SLEEP';

export type MindIntention =
  | 'Investigate'
  | 'Explore'
  | 'Stay'
  | 'Leave'
  | 'Approach'
  | 'Observe'
  | 'Grasp'
  | 'Manipulate'
  | 'Test_Force'
  | 'Inspect';

export interface TactileReceptorSignal {
  contact: boolean;
  normalForceN: number;
  shearForceN: number;
  skinDeformationMm: number;
  vibrationHz: number;
  vibrationAmplitude: number;
  slipDetected: boolean;
  slipProbability: number;
  roughnessIndex: number;
  thermalDelta: number;
  impactTransient: boolean;
}

export interface ArtificialTactileState {
  hasContact: boolean;
  contactRegions: string[];
  totalNormalForceN: number;
  totalShearForceN: number;
  maxDeformationMm: number;
  dominantVibrationHz: number;
  meanVibrationEnergy: number;
  slipRisk: number;
  surfaceRoughnessEstimate: number;
  gripStability: number;
  thermalFlowRate: number;
  recentImpactSpike: boolean;
  activeObjectDistanceM: number;
}

export interface ProprioceptionState {
  isMoving: boolean;
  // Body metrics
  bodyPosition: [number, number, number];
  chassisYawDeg: number;
  bodyLinearVelocityMps: [number, number, number];
  bodyAngularVelocityDegPs: number;
  bodyLinearAccelerationMps2: [number, number, number];
  // Independent Head / Neck state
  head: {
    neckYawDeg: number;
    neckPitchDeg: number;
    neckYawVelocityDegPs: number;
    neckPitchVelocityDegPs: number;
    neckYawTargetDeg: number;
    neckPitchTargetDeg: number;
  };
  // Wheel mechanics
  wheels: {
    leftWheelVelocityMps: number;
    rightWheelVelocityMps: number;
    leftWheelRotationRad: number;
    rightWheelRotationRad: number;
    wheelSlipIndex: number;
    groundContact: boolean;
  };
  // Arm kinematics
  armExtensionRatio: number;
  wristWorldPosition: [number, number, number];
  wristRelativePosition: [number, number, number];
  wristRotationDeg: number;
  jointVelocities: {
    arm: number;
    wrist: number;
    fingers: number;
  };
  payloadMassResistance: number;
  distanceToNearestSurfaceM: number;
  isReachingTarget: boolean;
  // Hand kinematics & state
  handApertureM: number;
  fingerFlexionDeg: {
    thumb: number;
    index: number;
    middle: number;
    pinky: number;
  };
  isGripping: boolean;
  heldObjectId: string | null;
  heldObjectDimensionM?: number;
}

export interface DiscoveredConsequence {
  id: string;
  cycleLearned: number;
  approxPosition: [number, number];
  actionUsed: string;
  appliedForceLevel: string;
  sensoryOutcome: string;
  discoveredProperty: string;
}

export interface HumanAdvisorMessage {
  id: string;
  sender: 'human' | 'ai';
  text: string;
  timestamp: string;
}

export interface SandboxObjectConfig {
  id: string;
  name: string;
  shape: 'box' | 'sphere' | 'cylinder' | 'cone' | 'torus' | 'prism' | 'dodecahedron' | 'capsule';
  position: [number, number, number];
  size: [number, number, number];
  colorHex: number;
  spectralProfileName: string;
  materialName: string;
  massKg: number;
  compliance: number;
  surfaceRoughness: number;
  isDestructible: boolean;
}

export interface CognitiveDecision {
  observation_summary: string;
  decision_summary: string;
  intention: MindIntention;
  chosen_action: ActionName;
  action_arguments: Record<string, any>;
  estimated_interest: number;
  sleep_duration_seconds: number;
  hypotheses?: string;
  // Continuous physical turn & locomotion control
  action_type?: 'CONTINUE_EXPLORING' | 'END_TURN';
  neck_yaw_target?: number;
  neck_pitch_target?: number;
  movement_intention?: string;
  end_turn_reason?: string;
  unresolved_questions?: string;
  // Multi-action awake cycle controls
  continue_acting?: boolean;
  exploration_goal?: string;
  response_to_human?: string;
  mental_computational_scratchpad?: string;
  sandbox_code_to_execute?: string;
  artifact_to_create_or_modify?: {
    name: string;
    contents: string;
    reason_for_modification?: string;
  };
}

export interface EncounteredFeatureMemory {
  id: string;
  approxPosition: [number, number]; // [x, z]
  spectralCharacteristics: string;
  investigationCount: number;
  lastVisitedCycle: number;
}

export interface CompactAgentMemory {
  exploredGrid: Array<{ x: number; z: number }>;
  encounteredFeatures: EncounteredFeatureMemory[];
  discoveredConsequences: DiscoveredConsequence[];
  recentCycles: Array<{
    cycle: number;
    intention: MindIntention;
    actionDescription: string;
    observationSummary: string;
    decisionSummary: string;
    sensoryDelta: number;
    wasEffective: boolean;
  }>;
  consecutiveStationaryCount: number;
  repeatedActionCount: number;
  lastActionName: string | null;
  suppressedActionNotice: string | null;
  sandboxPerturbations?: string[];
}

export interface DigitalVoidMetrics {
  startTime: number;
  totalDurationSeconds: number;
  cognitionCycles: number;
  headRotationsCount: number;
  repeatedSensoryStateCount: number;
  quotaEventsCount: number;
  selfGeneratedQuestionsCount: number;
  selfGeneratedHypothesesCount: number;
  referencesToUncertaintyCount: number;
  referencesToLocationCount: number;
  sensoryStateChangesCount: number;
  repeatedActionsCount: number;
}

export interface PersistentArtifact {
  name: string;
  contents: string;
  creation_cycle: number;
  last_modified_cycle: number;
  modifications: Array<{
    cycle: number;
    contents: string;
    reason?: string;
  }>;
}

export interface StructuredSandboxResult {
  success: boolean;
  returned_value?: any;
  stdout: string;
  stderr: string;
  execution_time_ms: number;
  error_message?: string;
}

export interface DigitalVoidTimelineEvent {
  id: string;
  cycle: number;
  timestamp: string;
  sensoryStateSummary: string;
  action: string;
  resultingSensoryStateSummary: string;
  nextCognitionSummary: string;
  hypothesis?: string;
  attentionTarget?: string;
  uncertaintyLevel?: string;
  isRestart?: boolean;
  isQuotaEvent?: boolean;
  mental_computational_scratchpad?: string;
  sandbox_code_to_execute?: string;
  sandbox_execution_result?: string | StructuredSandboxResult;
  persistent_artifacts?: PersistentArtifact[];
}

export interface AIMindState {
  status: ConsciousStatus;
  isDigitalVoid?: boolean;
  awakePhase?: 'REASONING' | 'ACTING' | 'IDLE';
  activeModel?: string;
  currentObservation: string;
  tactileSummary: string;
  proprioceptionSummary: string;
  auditorySummary?: string;
  thoughtSummary: string;
  intention: MindIntention;
  currentAction: string;
  previousAction: string;
  timeSinceLastWake: number; // in seconds
  timeUntilNextWake: number; // in seconds
  sleepDuration: number; // in seconds
  wakeCycleCount: number;
  currentStepInCycle?: number;
  maxStepsInCycle?: number;
  explorationGoal?: string;
  responseToHuman?: string;
  mentalComputationalScratchpad?: string;
  sandboxCodeToExecute?: string;
  sandboxExecutionResult?: string | StructuredSandboxResult;
  persistentArtifacts?: PersistentArtifact[];
  actionType?: 'CONTINUE_EXPLORING' | 'END_TURN';
  endTurnReason?: string;
  unresolvedQuestions?: string;
  lastObservation?: string;
  lastAction?: string;
  neckYaw?: number;
  neckPitch?: number;
  estimatedInterest: number;
  consecutiveStationary: number;
  isRateLimited: boolean;
  tactileState?: ArtificialTactileState;
  proprioceptionState?: ProprioceptionState;
  auditoryState?: ArtificialAuditoryState;
  sensoryToggles?: SensoryToggles;
  discoveredConsequences: DiscoveredConsequence[];
  advisorMessages: HumanAdvisorMessage[];
}

export interface MindTimelineEvent {
  id: string;
  timestamp: string;
  stage: 'WOKE' | 'OBSERVED' | 'DECISION' | 'ACTION' | 'SLEEPING' | 'WAITING_FOR_USER' | 'ANTI_LOOP' | 'RATE_LIMIT';
  summary: string;
  details?: any;
}

export interface AgentDecisionResponse {
  thought: string;
  toolCall: ToolCallPayload;
  hypotheses?: string;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  category:
    | 'WORLD STATE'
    | 'ARTIFICIAL EYE'
    | 'RETINA'
    | 'AI INPUT'
    | 'GEMINI DECISION'
    | 'TOOL CALL'
    | 'TOOL RESULT'
    | 'SYSTEM';
  message: string;
  details?: any;
}
