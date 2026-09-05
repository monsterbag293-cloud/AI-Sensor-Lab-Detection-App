/**
 * Three.js 3D Simulation World & Multisensory Physical Perception Engine
 *
 * Implements:
 * - Enclosed physical testing chamber (10m x 4m x 10m)
 * - 11+ complex geometric test objects:
 *   * Red Cube (compliant, breakable under high squeeze force -> 3 physical fragments!)
 *   * Green Sphere (smooth, elastic, movable)
 *   * Blue Cylinder (metallic, rigid, heavy)
 *   * Yellow Cone (rough texture, high friction)
 *   * White Pedestal Block (immovable foundation)
 *   * Toroid / Ring (concave with center hole!)
 *   * Triangular Prism (sharp angled facets)
 *   * Hexagonal Prism (multi-faceted bolt)
 *   * Star Polyhedron (asymmetric concave/convex spikes)
 *   * Hollow Cup / Vessel (concave opening, thin walls)
 *   * Joint Bracket (multi-part rigid assembly)
 * - Persistent physical fracture system (destructible objects shatter into genuine independent 3D pieces that remain in the chamber)
 * - Embodied robot avatar with articulated robotic arm, wrist, and articulated fingers (Thumb, Index, Middle, Pinky)
 * - Biologically inspired Artificial Touch (Virtual Skin) with SA-I, SA-II, RA-I, and PC receptors
 * - Artificial Proprioception (joint angles, velocities, kinesthetic load, distance to objects)
 * - Smooth procedural kinematics and animations (reach, grasp, release, squeeze, lift, push, pull, poke, stroke_surface, rotate, inspect)
 * - 16x16 spatial spectral raycaster calculating incident radiance L(λ) and S/M/L cone responses
 * - Graceful target resolution (fixes interact 'region_1' issue)
 */

import * as THREE from 'three';
import {
  WAVELENGTHS,
  NUM_BANDS,
  LIGHT_PRESETS,
  LightPresetData,
  MATERIAL_PROFILES,
  MaterialSpectralProfile,
  calculateIncidentRadiance,
  integrateConeResponses,
  calculateExtendedRadiance,
  integrateAllPhotoreceptors,
  spectrumToHumanRGB,
} from '../perception/spectral';
import {
  ArtificialRetinaProcessor,
  RETINA_RES,
  TOTAL_RECEPTORS,
  RawRetinaFrame,
} from '../perception/retina';
import { ArtificialSkinSystem, PhysicalContactEvent } from '../perception/tactile';
import {
  ArtificialProprioceptionSystem,
  ArmKinematicsInput,
} from '../perception/proprioception';
import {
  ArtificialAuditoryProcessor,
} from '../perception/auditory';
import {
  AgentPose,
  ArtificialVisionState,
  ToolCallPayload,
  WorldObjectInfo,
  ArtificialTactileState,
  ProprioceptionState,
  VisualProtoRegion,
  ArtificialAuditoryState,
  SensoryToggles,
  AcousticEvent,
} from '../types';

export interface WorldObjectPhysicalData {
  id: string;
  name: string;
  shape: string;
  position: [number, number, number];
  size: [number, number, number];
  mesh: THREE.Mesh;
  profile: MaterialSpectralProfile;
  info: WorldObjectInfo;
  massKg: number;
  compliance: number; // 0.02 (rigid) to 0.8 (soft/compliant)
  surfaceRoughness: number; // 0.05 (smooth) to 0.9 (rough)
  frictionCoeff: number; // 0.15 to 0.85
  isMovable: boolean;
  isDestructible: boolean;
  fractureThresholdN: number;
  isFragment: boolean;
  parentObjectId?: string;
  isHeld: boolean;
  velocity: THREE.Vector3;
}

export interface MotorAnimation {
  name: string;
  startTime: number;
  duration: number; // in seconds
  startArmExt: number;
  targetArmExt: number;
  startWristPos: THREE.Vector3;
  targetWristPos: THREE.Vector3;
  startFlexion: number; // 0 to 90
  targetFlexion: number;
  startAperture: number;
  targetAperture: number;
  startPitch: number;
  targetPitch: number;
  targetObjId?: string;
  onUpdate?: (progress: number) => void;
  onFinish?: () => void;
}

export interface WorldConfig {
  container: HTMLElement;
  humanDebugCanvas: HTMLCanvasElement;
  onStateUpdate?: (
    state: ArtificialVisionState,
    pose: AgentPose,
    tactile: ArtificialTactileState,
    proprio: ProprioceptionState,
    auditory?: ArtificialAuditoryState
  ) => void;
  onActionComplete?: (action: ToolCallPayload, result: string) => void;
}

export class SimulatedWorld {
  private container: HTMLElement;
  private humanDebugCanvas: HTMLCanvasElement;
  private debugCtx: CanvasRenderingContext2D | null;

  private scene: THREE.Scene;
  private renderer: THREE.WebGLRenderer;
  private humanCamera: THREE.PerspectiveCamera;
  private eyeCamera: THREE.PerspectiveCamera;

  // Orbit-like drag state for third person camera
  private isDragging = false;
  private prevMouseX = 0;
  private prevMouseY = 0;
  private humanCamTheta = Math.PI / 4;
  private humanCamPhi = Math.PI / 3.2;
  private humanCamDistance = 11;
  private humanCamTarget = new THREE.Vector3(0, 1.2, 0);

  // View mode: 'third_person' or 'agent_pov'
  public viewMode: 'third_person' | 'agent_pov' = 'third_person';

  // Embodied Agent Pose
  public agentPose: AgentPose = {
    x: 0,
    y: 1.1,
    z: 0.5,
    yaw: 0,
    pitch: 0,
    fov: 75,
  };

  private agentGroup!: THREE.Group;
  private agentHead!: THREE.Group;
  private agentEyeLens!: THREE.Mesh;
  private agentFrustumCone!: THREE.LineSegments;

  // Articulated Arm & Hand hierarchy
  private agentShoulderGroup!: THREE.Group;
  private agentUpperArmMesh!: THREE.Mesh;
  private agentElbowGroup!: THREE.Group;
  private agentForearmMesh!: THREE.Mesh;
  private agentWristGroup!: THREE.Group;
  private agentPalmMesh!: THREE.Mesh;
  private thumbGroup!: THREE.Group;
  private indexFingerGroup!: THREE.Group;
  private middleFingerGroup!: THREE.Group;
  private pinkyFingerGroup!: THREE.Group;
  private fingertipSensors: THREE.Mesh[] = [];

  // Arm & Hand Kinematic State
  private armExtension: number = 0.0; // 0.0 (retracted) to 1.0 (extended)
  private handApertureM: number = 0.14; // 0 (closed) to 0.18 (open)
  private fingerFlexionDeg: number = 10; // 0 to 90
  private wristRollDeg: number = 0;
  private isGripping: boolean = false;
  private heldObjectId: string | null = null;
  private heldObjectOffset: THREE.Vector3 = new THREE.Vector3(0, 0, 0);

  // Active Motor Animation
  private activeAnimation: MotorAnimation | null = null;
  private bodyTurnTarget: { startYaw: number; targetYaw: number; startTime: number; duration: number } | null = null;
  private bodyMoveTarget: { startPos: THREE.Vector3; targetPos: THREE.Vector3; startTime: number; duration: number } | null = null;

  // Scene Objects
  private physicalObjects: Map<string, WorldObjectPhysicalData> = new Map();
  private wallMeshes: THREE.Mesh[] = [];
  private floorMesh!: THREE.Mesh;
  private ceilingMesh!: THREE.Mesh;
  private ceilingLightMesh!: THREE.Mesh;

  // Lighting
  public activeLightPreset: LightPresetData = LIGHT_PRESETS[0]; // D65 default
  private mainLight!: THREE.PointLight;
  private ambientLight!: THREE.AmbientLight;

  // Sensory Processing Subsystems
  private retinaProcessor = new ArtificialRetinaProcessor();
  private skinSystem = new ArtificialSkinSystem();
  private proprioSystem = new ArtificialProprioceptionSystem();
  private auditoryProcessor = new ArtificialAuditoryProcessor();
  private raycaster = new THREE.Raycaster();
  private rayGridDirections: THREE.Vector3[] = [];

  // Experimental Digital Void Mode
  public isDigitalVoid: boolean = false;

  // Sensory Toggles (User-controllable)
  public sensoryToggles: SensoryToggles = {
    vision: true,
    sevenConeVision: true,
    hearing: true,
    uvVision: true,
    irVision: true,
    proprioception: true,
    tactile: true,
  };

  // Cached Sensory States
  public currentAuditoryState: ArtificialAuditoryState = this.auditoryProcessor.process(
    { x: 0, y: 1.1, z: 0.5, yaw: 0, pitch: 0, fov: 75 },
    [0, 0, 0],
    0,
    true
  );
  // Independent Head/Neck Kinematics
  public neckYaw: number = 0; // -120 to +120 relative to chassis
  public neckPitch: number = 0; // -45 to +45
  public neckYawTarget: number = 0;
  public neckPitchTarget: number = 0;
  public neckYawVel: number = 0;
  public neckPitchVel: number = 0;

  // Wheel mechanics & body kinematics
  public leftWheelVel: number = 0;
  public rightWheelVel: number = 0;
  public leftWheelRot: number = 0;
  public rightWheelRot: number = 0;
  public wheelSlipIndex: number = 0;
  private lastBodyPos: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  private lastBodyVel: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  private bodyLinearVel: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  private bodyLinearAccel: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  private bodyAngularVelDegPs: number = 0;
  private lastChassisYaw: number = 0;

  public currentTactileState: ArtificialTactileState = {
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
    activeObjectDistanceM: 2.5,
  };

  public currentProprioState: ProprioceptionState = {
    isMoving: false,
    bodyPosition: [0, 0, 0],
    chassisYawDeg: 0,
    bodyLinearVelocityMps: [0, 0, 0],
    bodyAngularVelocityDegPs: 0,
    bodyLinearAccelerationMps2: [0, 0, 0],
    head: {
      neckYawDeg: 0,
      neckPitchDeg: 0,
      neckYawVelocityDegPs: 0,
      neckPitchVelocityDegPs: 0,
      neckYawTargetDeg: 0,
      neckPitchTargetDeg: 0,
    },
    wheels: {
      leftWheelVelocityMps: 0,
      rightWheelVelocityMps: 0,
      leftWheelRotationRad: 0,
      rightWheelRotationRad: 0,
      wheelSlipIndex: 0,
      groundContact: true,
    },
    armExtensionRatio: 0.0,
    wristWorldPosition: [0, 0.8, 0.3],
    wristRelativePosition: [0.3, -0.3, 0.2],
    wristRotationDeg: 0,
    handApertureM: 0.14,
    fingerFlexionDeg: { thumb: 10, index: 10, middle: 10, pinky: 10 },
    isGripping: false,
    heldObjectId: null,
    jointVelocities: { arm: 0, wrist: 0, fingers: 0 },
    payloadMassResistance: 0.0,
    distanceToNearestSurfaceM: 2.5,
    isReachingTarget: false,
  };

  public lastSalientRegions: VisualProtoRegion[] = [];

  // High-performance geometry caching and reusable vector buffers for 32x32 retina
  private cachedTargetMeshes: THREE.Mesh[] = [];
  private cachedDebugImageData: ImageData | null = null;
  private tempRayDir = new THREE.Vector3();
  private tempEyeWorldPos = new THREE.Vector3();
  private tempEyeWorldQuat = new THREE.Quaternion();
  private tempHitNormal = new THREE.Vector3();
  private tempHitToLight = new THREE.Vector3();
  private lastRetinaSampleTime = 0;
  private lastVisionState: ArtificialVisionState | null = null;

  // Animation & Execution
  private animationFrameId: number = 0;
  private lastFrameTime = performance.now();
  private isPaused = false;
  public currentActionDesc: string = 'Idle';

  // Callbacks
  private onStateUpdate?: (
    state: ArtificialVisionState,
    pose: AgentPose,
    tactile: ArtificialTactileState,
    proprio: ProprioceptionState,
    auditory?: ArtificialAuditoryState
  ) => void;
  private onActionComplete?: (action: ToolCallPayload, result: string) => void;

  constructor(config: WorldConfig) {
    this.container = config.container;
    this.humanDebugCanvas = config.humanDebugCanvas;
    this.debugCtx = this.humanDebugCanvas.getContext('2d');
    this.onStateUpdate = config.onStateUpdate;
    this.onActionComplete = config.onActionComplete;

    // Initialize Three.js scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x151619);

    const width = this.container.clientWidth || 800;
    const height = this.container.clientHeight || 500;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.style.outline = 'none';
    this.container.appendChild(this.renderer.domElement);

    // Human observer camera
    this.humanCamera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
    this.updateHumanCameraPosition();

    // Artificial Eye camera
    this.eyeCamera = new THREE.PerspectiveCamera(this.agentPose.fov, 1, 0.1, 50);

    // Lighting setup
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.35);
    this.scene.add(this.ambientLight);

    this.mainLight = new THREE.PointLight(0xffffff, 2.5, 20);
    this.mainLight.position.set(0, 3.7, 0);
    this.mainLight.castShadow = true;
    this.mainLight.shadow.mapSize.width = 1024;
    this.mainLight.shadow.mapSize.height = 1024;
    this.scene.add(this.mainLight);

    // Build Environment
    this.buildEnclosure();
    this.buildPhysicalObjects();
    this.agentGroup = this.buildAgentAvatar();
    this.scene.add(this.agentGroup);

    // Cache target meshes for retinal raycaster
    this.updateCachedTargetMeshes();

    // Setup 32x32 eye ray direction grid (1024 photoreceptors)
    this.setupRetinaRayGrid();

    // Mouse controls for human observer camera
    this.initMouseControls();

    // Start render & perception loop
    this.animate = this.animate.bind(this);
    this.animationFrameId = requestAnimationFrame(this.animate);
  }

  /**
   * Builds the enclosed room walls, floor, and ceiling
   */
  private buildEnclosure() {
    const roomW = 10;
    const roomH = 4;
    const roomD = 10;

    // Floor
    const floorGeo = new THREE.PlaneGeometry(roomW, roomD);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x383c44,
      roughness: 0.85,
      metalness: 0.1,
    });
    this.floorMesh = new THREE.Mesh(floorGeo, floorMat);
    this.floorMesh.rotation.x = -Math.PI / 2;
    this.floorMesh.position.y = 0;
    this.floorMesh.receiveShadow = true;
    (this.floorMesh as any).spectralProfile = MATERIAL_PROFILES.floor_surface;
    (this.floorMesh as any).surfaceId = 'floor';
    this.scene.add(this.floorMesh);

    // Ceiling
    const ceilGeo = new THREE.PlaneGeometry(roomW, roomD);
    const ceilMat = new THREE.MeshStandardMaterial({
      color: 0xcccccc,
      roughness: 0.9,
    });
    this.ceilingMesh = new THREE.Mesh(ceilGeo, ceilMat);
    this.ceilingMesh.rotation.x = Math.PI / 2;
    this.ceilingMesh.position.y = roomH;
    (this.ceilingMesh as any).spectralProfile = MATERIAL_PROFILES.ceiling_surface;
    (this.ceilingMesh as any).surfaceId = 'ceiling';
    this.scene.add(this.ceilingMesh);

    // Ceiling light fixture visual
    const lightFixtureGeo = new THREE.CylinderGeometry(0.8, 0.8, 0.1, 24);
    const lightFixtureMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.ceilingLightMesh = new THREE.Mesh(lightFixtureGeo, lightFixtureMat);
    this.ceilingLightMesh.position.set(0, roomH - 0.05, 0);
    this.scene.add(this.ceilingLightMesh);

    // Room Walls
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0xc8c4bd,
      roughness: 0.8,
      metalness: 0.05,
    });

    const wallDefs = [
      { name: 'north_wall', pos: [0, roomH / 2, -roomD / 2], rot: [0, 0, 0], size: [roomW, roomH] },
      { name: 'south_wall', pos: [0, roomH / 2, roomD / 2], rot: [0, Math.PI, 0], size: [roomW, roomH] },
      { name: 'east_wall', pos: [roomW / 2, roomH / 2, 0], rot: [0, -Math.PI / 2, 0], size: [roomD, roomH] },
      { name: 'west_wall', pos: [-roomW / 2, roomH / 2, 0], rot: [0, Math.PI / 2, 0], size: [roomD, roomH] },
    ];

    for (const def of wallDefs) {
      const geo = new THREE.PlaneGeometry(def.size[0], def.size[1]);
      const mesh = new THREE.Mesh(geo, wallMat.clone());
      mesh.position.set(def.pos[0], def.pos[1], def.pos[2]);
      mesh.rotation.set(def.rot[0], def.rot[1], def.rot[2]);
      mesh.receiveShadow = true;
      (mesh as any).spectralProfile = MATERIAL_PROFILES.wall_concrete;
      (mesh as any).surfaceId = def.name;
      this.scene.add(mesh);
      this.wallMeshes.push(mesh);
    }
  }

  /**
   * Places rich variety of complex 3D objects with diverse shapes and physical properties
   */
  private buildPhysicalObjects() {
    // 1. Red Cube (Elastic & Breakable under high force!)
    const redGeo = new THREE.BoxGeometry(1.2, 1.2, 1.2);
    const redMat = new THREE.MeshStandardMaterial({ color: 0xe53935, roughness: 0.45, metalness: 0.1 });
    const redMesh = new THREE.Mesh(redGeo, redMat);
    redMesh.position.set(-2.4, 0.6, -2.4);
    redMesh.rotation.y = 0.35;
    redMesh.castShadow = true;
    redMesh.receiveShadow = true;
    (redMesh as any).spectralProfile = MATERIAL_PROFILES.red_sample;
    (redMesh as any).surfaceId = 'object_alpha_red';
    this.scene.add(redMesh);
    this.physicalObjects.set('object_alpha_red', {
      id: 'object_alpha_red',
      name: 'Object Alpha (Polyhedral Red Block)',
      shape: 'box',
      position: [-2.4, 0.6, -2.4],
      size: [1.2, 1.2, 1.2],
      mesh: redMesh,
      profile: MATERIAL_PROFILES.red_sample,
      info: {
        id: 'object_alpha_red',
        name: 'Object Alpha (Long-Wave / Red Cube)',
        shape: 'box',
        position: [-2.4, 0.6, -2.4],
        size: [1.2, 1.2, 1.2],
        materialName: 'Compliant Long-Wave Reflective',
        spectralProfileName: 'red_sample',
      },
      massKg: 1.8,
      compliance: 0.45, // Soft/compliant
      surfaceRoughness: 0.35,
      frictionCoeff: 0.55,
      isMovable: true,
      isDestructible: true,
      fractureThresholdN: 35.0, // Shatters if squeezed > 35N
      isFragment: false,
      isHeld: false,
      velocity: new THREE.Vector3(0, 0, 0),
    });

    // 2. Green Sphere (Elastic, bouncing, smooth)
    const greenGeo = new THREE.SphereGeometry(0.7, 32, 24);
    const greenMat = new THREE.MeshStandardMaterial({ color: 0x43a047, roughness: 0.18, metalness: 0.1 });
    const greenMesh = new THREE.Mesh(greenGeo, greenMat);
    greenMesh.position.set(2.4, 0.7, -2.2);
    greenMesh.castShadow = true;
    greenMesh.receiveShadow = true;
    (greenMesh as any).spectralProfile = MATERIAL_PROFILES.green_sample;
    (greenMesh as any).surfaceId = 'object_beta_green';
    this.scene.add(greenMesh);
    this.physicalObjects.set('object_beta_green', {
      id: 'object_beta_green',
      name: 'Object Beta (Medium-Wave Sphere)',
      shape: 'sphere',
      position: [2.4, 0.7, -2.2],
      size: [1.4, 1.4, 1.4],
      mesh: greenMesh,
      profile: MATERIAL_PROFILES.green_sample,
      info: {
        id: 'object_beta_green',
        name: 'Object Beta (Medium-Wave / Green Sphere)',
        shape: 'sphere',
        position: [2.4, 0.7, -2.2],
        size: [1.4, 1.4, 1.4],
        materialName: 'Smooth Medium-Wave Reflective',
        spectralProfileName: 'green_sample',
      },
      massKg: 0.8,
      compliance: 0.25,
      surfaceRoughness: 0.12,
      frictionCoeff: 0.3,
      isMovable: true,
      isDestructible: false,
      fractureThresholdN: 150.0,
      isFragment: false,
      isHeld: false,
      velocity: new THREE.Vector3(0, 0, 0),
    });

    // 3. Blue Vertical Cylinder (Rigid, heavy metal)
    const blueGeo = new THREE.CylinderGeometry(0.55, 0.55, 1.6, 32);
    const blueMat = new THREE.MeshStandardMaterial({ color: 0x1e88e5, roughness: 0.3, metalness: 0.6 });
    const blueMesh = new THREE.Mesh(blueGeo, blueMat);
    blueMesh.position.set(-2.6, 0.8, 2.2);
    blueMesh.castShadow = true;
    blueMesh.receiveShadow = true;
    (blueMesh as any).spectralProfile = MATERIAL_PROFILES.blue_sample;
    (blueMesh as any).surfaceId = 'object_gamma_blue';
    this.scene.add(blueMesh);
    this.physicalObjects.set('object_gamma_blue', {
      id: 'object_gamma_blue',
      name: 'Object Gamma (Short-Wave Cylinder)',
      shape: 'cylinder',
      position: [-2.6, 0.8, 2.2],
      size: [1.1, 1.6, 1.1],
      mesh: blueMesh,
      profile: MATERIAL_PROFILES.blue_sample,
      info: {
        id: 'object_gamma_blue',
        name: 'Object Gamma (Short-Wave / Blue Cylinder)',
        shape: 'cylinder',
        position: [-2.6, 0.8, 2.2],
        size: [1.1, 1.6, 1.1],
        materialName: 'Rigid Short-Wave Reflective',
        spectralProfileName: 'blue_sample',
      },
      massKg: 3.8,
      compliance: 0.05,
      surfaceRoughness: 0.2,
      frictionCoeff: 0.45,
      isMovable: true,
      isDestructible: false,
      fractureThresholdN: 300.0,
      isFragment: false,
      isHeld: false,
      velocity: new THREE.Vector3(0, 0, 0),
    });

    // 4. Yellow Cone (Rough surface, high friction)
    const yellowGeo = new THREE.ConeGeometry(0.75, 1.6, 32);
    const yellowMat = new THREE.MeshStandardMaterial({ color: 0xfdd835, roughness: 0.75, metalness: 0.05 });
    const yellowMesh = new THREE.Mesh(yellowGeo, yellowMat);
    yellowMesh.position.set(2.4, 0.8, 2.1);
    yellowMesh.castShadow = true;
    yellowMesh.receiveShadow = true;
    (yellowMesh as any).spectralProfile = MATERIAL_PROFILES.yellow_sample;
    (yellowMesh as any).surfaceId = 'object_delta_yellow';
    this.scene.add(yellowMesh);
    this.physicalObjects.set('object_delta_yellow', {
      id: 'object_delta_yellow',
      name: 'Object Delta (Rough M+L Cone)',
      shape: 'cone',
      position: [2.4, 0.8, 2.1],
      size: [1.5, 1.6, 1.5],
      mesh: yellowMesh,
      profile: MATERIAL_PROFILES.yellow_sample,
      info: {
        id: 'object_delta_yellow',
        name: 'Object Delta (Dual Medium+Long Wave / Yellow Cone)',
        shape: 'cone',
        position: [2.4, 0.8, 2.1],
        size: [1.5, 1.6, 1.5],
        materialName: 'Coarse M+L Reflective',
        spectralProfileName: 'yellow_sample',
      },
      massKg: 1.5,
      compliance: 0.1,
      surfaceRoughness: 0.82,
      frictionCoeff: 0.85,
      isMovable: true,
      isDestructible: false,
      fractureThresholdN: 180.0,
      isFragment: false,
      isHeld: false,
      velocity: new THREE.Vector3(0, 0, 0),
    });

    // 5. White Monolith Pedestal (Heavy immovable fixture)
    const whiteGeo = new THREE.BoxGeometry(1.2, 1.2, 1.2);
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.25, metalness: 0.05 });
    const whiteMesh = new THREE.Mesh(whiteGeo, whiteMat);
    whiteMesh.position.set(0, 0.6, -3.3);
    whiteMesh.rotation.y = 0.785;
    whiteMesh.castShadow = true;
    whiteMesh.receiveShadow = true;
    (whiteMesh as any).spectralProfile = MATERIAL_PROFILES.white_sample;
    (whiteMesh as any).surfaceId = 'object_epsilon_white';
    this.scene.add(whiteMesh);
    this.physicalObjects.set('object_epsilon_white', {
      id: 'object_epsilon_white',
      name: 'Object Epsilon (Monolith Foundation)',
      shape: 'box',
      position: [0, 0.6, -3.3],
      size: [1.2, 1.2, 1.2],
      mesh: whiteMesh,
      profile: MATERIAL_PROFILES.white_sample,
      info: {
        id: 'object_epsilon_white',
        name: 'Object Epsilon (Uniform High Reflectance / White Monolith)',
        shape: 'box',
        position: [0, 0.6, -3.3],
        size: [1.2, 1.2, 1.2],
        materialName: 'Immovable Foundation Stone',
        spectralProfileName: 'white_sample',
      },
      massKg: 150.0, // Immovable
      compliance: 0.02,
      surfaceRoughness: 0.22,
      frictionCoeff: 0.7,
      isMovable: false,
      isDestructible: false,
      fractureThresholdN: 9999.0,
      isFragment: false,
      isHeld: false,
      velocity: new THREE.Vector3(0, 0, 0),
    });

    // 6. Toroid / Ring (Concave with center opening!)
    const torusGeo = new THREE.TorusGeometry(0.55, 0.16, 24, 36);
    const torusMat = new THREE.MeshStandardMaterial({ color: 0xd81b60, roughness: 0.35, metalness: 0.2 });
    const torusMesh = new THREE.Mesh(torusGeo, torusMat);
    torusMesh.position.set(3.2, 0.6, 0.0);
    torusMesh.rotation.x = Math.PI / 2;
    torusMesh.castShadow = true;
    torusMesh.receiveShadow = true;
    (torusMesh as any).spectralProfile = MATERIAL_PROFILES.torus_magenta;
    (torusMesh as any).surfaceId = 'object_zeta_torus';
    this.scene.add(torusMesh);
    this.physicalObjects.set('object_zeta_torus', {
      id: 'object_zeta_torus',
      name: 'Object Zeta (Toroidal Ring)',
      shape: 'torus',
      position: [3.2, 0.6, 0.0],
      size: [1.4, 0.35, 1.4],
      mesh: torusMesh,
      profile: MATERIAL_PROFILES.torus_magenta,
      info: {
        id: 'object_zeta_torus',
        name: 'Object Zeta (Toroidal Ring with Central Void)',
        shape: 'box',
        position: [3.2, 0.6, 0.0],
        size: [1.4, 0.35, 1.4],
        materialName: 'Dual S+L Reflective Toroid',
        spectralProfileName: 'torus_magenta',
      },
      massKg: 1.1,
      compliance: 0.12,
      surfaceRoughness: 0.3,
      frictionCoeff: 0.5,
      isMovable: true,
      isDestructible: false,
      fractureThresholdN: 120.0,
      isFragment: false,
      isHeld: false,
      velocity: new THREE.Vector3(0, 0, 0),
    });

    // 7. Triangular Prism (Sharp faceted edges)
    const prismGeo = new THREE.CylinderGeometry(0.65, 0.65, 1.3, 3);
    const prismMat = new THREE.MeshStandardMaterial({ color: 0x00acc1, roughness: 0.5, metalness: 0.1 });
    const prismMesh = new THREE.Mesh(prismGeo, prismMat);
    prismMesh.position.set(-3.2, 0.65, 0.0);
    prismMesh.rotation.y = 0.5;
    prismMesh.castShadow = true;
    prismMesh.receiveShadow = true;
    (prismMesh as any).spectralProfile = MATERIAL_PROFILES.prism_cyan;
    (prismMesh as any).surfaceId = 'object_eta_prism';
    this.scene.add(prismMesh);
    this.physicalObjects.set('object_eta_prism', {
      id: 'object_eta_prism',
      name: 'Object Eta (Triangular Prism)',
      shape: 'prism',
      position: [-3.2, 0.65, 0.0],
      size: [1.3, 1.3, 1.3],
      mesh: prismMesh,
      profile: MATERIAL_PROFILES.prism_cyan,
      info: {
        id: 'object_eta_prism',
        name: 'Object Eta (Triangular Prism)',
        shape: 'box',
        position: [-3.2, 0.65, 0.0],
        size: [1.3, 1.3, 1.3],
        materialName: 'Cyan Prism with Acute Vertices',
        spectralProfileName: 'prism_cyan',
      },
      massKg: 1.9,
      compliance: 0.08,
      surfaceRoughness: 0.45,
      frictionCoeff: 0.6,
      isMovable: true,
      isDestructible: false,
      fractureThresholdN: 140.0,
      isFragment: false,
      isHeld: false,
      velocity: new THREE.Vector3(0, 0, 0),
    });

    // 8. Hexagonal Prism (Multi-faceted amber bolt)
    const hexGeo = new THREE.CylinderGeometry(0.55, 0.55, 1.4, 6);
    const hexMat = new THREE.MeshStandardMaterial({ color: 0xfb8c00, roughness: 0.38, metalness: 0.2 });
    const hexMesh = new THREE.Mesh(hexGeo, hexMat);
    hexMesh.position.set(-1.3, 0.7, 3.2);
    hexMesh.castShadow = true;
    hexMesh.receiveShadow = true;
    (hexMesh as any).spectralProfile = MATERIAL_PROFILES.hex_amber;
    (hexMesh as any).surfaceId = 'object_theta_hex';
    this.scene.add(hexMesh);
    this.physicalObjects.set('object_theta_hex', {
      id: 'object_theta_hex',
      name: 'Object Theta (Hexagonal Monolith)',
      shape: 'cylinder',
      position: [-1.3, 0.7, 3.2],
      size: [1.1, 1.4, 1.1],
      mesh: hexMesh,
      profile: MATERIAL_PROFILES.hex_amber,
      info: {
        id: 'object_theta_hex',
        name: 'Object Theta (Hexagonal Prism)',
        shape: 'cylinder',
        position: [-1.3, 0.7, 3.2],
        size: [1.1, 1.4, 1.1],
        materialName: 'Hexagonal Amber Facet Profile',
        spectralProfileName: 'hex_amber',
      },
      massKg: 2.5,
      compliance: 0.06,
      surfaceRoughness: 0.35,
      frictionCoeff: 0.55,
      isMovable: true,
      isDestructible: false,
      fractureThresholdN: 200.0,
      isFragment: false,
      isHeld: false,
      velocity: new THREE.Vector3(0, 0, 0),
    });

    // 9. Star Polyhedron (Concave and convex points)
    const starGeo = new THREE.IcosahedronGeometry(0.65, 0);
    const starMat = new THREE.MeshStandardMaterial({ color: 0x8e24aa, roughness: 0.4, metalness: 0.3 });
    const starMesh = new THREE.Mesh(starGeo, starMat);
    starMesh.position.set(1.3, 0.65, 3.2);
    starMesh.castShadow = true;
    starMesh.receiveShadow = true;
    (starMesh as any).spectralProfile = MATERIAL_PROFILES.star_poly;
    (starMesh as any).surfaceId = 'object_iota_star';
    this.scene.add(starMesh);
    this.physicalObjects.set('object_iota_star', {
      id: 'object_iota_star',
      name: 'Object Iota (Star Polyhedron)',
      shape: 'octahedron',
      position: [1.3, 0.65, 3.2],
      size: [1.3, 1.3, 1.3],
      mesh: starMesh,
      profile: MATERIAL_PROFILES.star_poly,
      info: {
        id: 'object_iota_star',
        name: 'Object Iota (Multi-Point Star Polyhedron)',
        shape: 'octahedron',
        position: [1.3, 0.65, 3.2],
        size: [1.3, 1.3, 1.3],
        materialName: 'Violet Polyhedron with Sharp Vertices',
        spectralProfileName: 'star_poly',
      },
      massKg: 1.0,
      compliance: 0.15,
      surfaceRoughness: 0.65,
      frictionCoeff: 0.7,
      isMovable: true,
      isDestructible: false,
      fractureThresholdN: 90.0,
      isFragment: false,
      isHeld: false,
      velocity: new THREE.Vector3(0, 0, 0),
    });

    // 10. Hollow Ceramic Vessel / Cup (Breakable brittle structure!)
    const cupGeo = new THREE.CylinderGeometry(0.5, 0.38, 0.9, 24, 1, true);
    const cupMat = new THREE.MeshStandardMaterial({ color: 0xa1887f, roughness: 0.8, metalness: 0.05, side: THREE.DoubleSide });
    const cupMesh = new THREE.Mesh(cupGeo, cupMat);
    cupMesh.position.set(-1.1, 0.45, -1.6);
    cupMesh.castShadow = true;
    cupMesh.receiveShadow = true;
    (cupMesh as any).spectralProfile = MATERIAL_PROFILES.hollow_cup;
    (cupMesh as any).surfaceId = 'object_kappa_cup';
    this.scene.add(cupMesh);
    this.physicalObjects.set('object_kappa_cup', {
      id: 'object_kappa_cup',
      name: 'Object Kappa (Hollow Ceramic Vessel)',
      shape: 'cylinder',
      position: [-1.1, 0.45, -1.6],
      size: [1.0, 0.9, 1.0],
      mesh: cupMesh,
      profile: MATERIAL_PROFILES.hollow_cup,
      info: {
        id: 'object_kappa_cup',
        name: 'Object Kappa (Hollow Concave Vessel)',
        shape: 'cylinder',
        position: [-1.1, 0.45, -1.6],
        size: [1.0, 0.9, 1.0],
        materialName: 'Brittle Ceramic Concave Vessel',
        spectralProfileName: 'hollow_cup',
      },
      massKg: 0.7,
      compliance: 0.08,
      surfaceRoughness: 0.78,
      frictionCoeff: 0.72,
      isMovable: true,
      isDestructible: true,
      fractureThresholdN: 28.0, // Shatters at 28N squeeze force
      isFragment: false,
      isHeld: false,
      velocity: new THREE.Vector3(0, 0, 0),
    });

    // 11. Multi-part Joint Bracket (Rigid metal assembly)
    const bracketGroup = new THREE.Group();
    const plateGeo1 = new THREE.BoxGeometry(0.3, 0.9, 0.8);
    const plateGeo2 = new THREE.BoxGeometry(0.8, 0.3, 0.8);
    const bracketMat = new THREE.MeshStandardMaterial({ color: 0x78909c, roughness: 0.45, metalness: 0.6 });
    const p1 = new THREE.Mesh(plateGeo1, bracketMat);
    p1.position.set(-0.25, 0.45, 0);
    p1.castShadow = true;
    bracketGroup.add(p1);
    const p2 = new THREE.Mesh(plateGeo2, bracketMat);
    p2.position.set(0.15, 0.15, 0);
    p2.castShadow = true;
    bracketGroup.add(p2);
    bracketGroup.position.set(1.1, 0, -1.6);
    this.scene.add(bracketGroup);

    // Bounding mesh for raycaster & collision
    const bracketProxyGeo = new THREE.BoxGeometry(1.0, 1.0, 0.9);
    const bracketProxyMat = new THREE.MeshBasicMaterial({ visible: false });
    const bracketMesh = new THREE.Mesh(bracketProxyGeo, bracketProxyMat);
    bracketMesh.position.set(1.1, 0.5, -1.6);
    (bracketMesh as any).spectralProfile = MATERIAL_PROFILES.bracket_alloy;
    (bracketMesh as any).surfaceId = 'object_lambda_bracket';
    this.scene.add(bracketMesh);
    this.physicalObjects.set('object_lambda_bracket', {
      id: 'object_lambda_bracket',
      name: 'Object Lambda (Assembled Joint Bracket)',
      shape: 'box',
      position: [1.1, 0.5, -1.6],
      size: [1.0, 1.0, 0.9],
      mesh: bracketMesh,
      profile: MATERIAL_PROFILES.bracket_alloy,
      info: {
        id: 'object_lambda_bracket',
        name: 'Object Lambda (Multi-Part Angle Bracket)',
        shape: 'box',
        position: [1.1, 0.5, -1.6],
        size: [1.0, 1.0, 0.9],
        materialName: 'High-Density Specular Alloy',
        spectralProfileName: 'bracket_alloy',
      },
      massKg: 4.2,
      compliance: 0.03,
      surfaceRoughness: 0.38,
      frictionCoeff: 0.5,
      isMovable: true,
      isDestructible: false,
      fractureThresholdN: 350.0,
      isFragment: false,
      isHeld: false,
      velocity: new THREE.Vector3(0, 0, 0),
    });
  }

  /**
   * Constructs the Embodied Agent 3D avatar with cybernetic sensor pod,
   * visual FOV frustum, and articulated Robotic Arm and Virtual Hand.
   */
  private buildAgentAvatar(): THREE.Group {
    const group = new THREE.Group();

    // 1. Base chassis
    const chassisGeo = new THREE.CylinderGeometry(0.35, 0.42, 0.45, 24);
    const chassisMat = new THREE.MeshStandardMaterial({ color: 0x212529, metalness: 0.8, roughness: 0.3 });
    const chassis = new THREE.Mesh(chassisGeo, chassisMat);
    chassis.position.y = 0.25;
    chassis.castShadow = true;
    group.add(chassis);

    // Tread/wheel accents
    const wheelGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.9, 16);
    wheelGeo.rotateZ(Math.PI / 2);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111113, roughness: 0.9 });
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.position.y = 0.18;
    group.add(wheel);

    // Center vertical spine
    const spineGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.6, 16);
    const spineMat = new THREE.MeshStandardMaterial({ color: 0x495057, metalness: 0.7 });
    const spine = new THREE.Mesh(spineGeo, spineMat);
    spine.position.y = 0.75;
    group.add(spine);

    // 2. Articulated Head (rotates with yaw & pitch)
    this.agentHead = new THREE.Group();
    this.agentHead.position.y = 1.05; // eye height
    group.add(this.agentHead);

    // Head casing
    const headGeo = new THREE.SphereGeometry(0.24, 20, 16);
    const headMat = new THREE.MeshStandardMaterial({ color: 0x343a40, metalness: 0.5, roughness: 0.4 });
    const head = new THREE.Mesh(headGeo, headMat);
    this.agentHead.add(head);

    // Eye Turret / Lens barrel
    const barrelGeo = new THREE.CylinderGeometry(0.12, 0.15, 0.2, 20);
    barrelGeo.rotateX(Math.PI / 2);
    const barrelMat = new THREE.MeshStandardMaterial({ color: 0x1a1c1e, metalness: 0.9, roughness: 0.2 });
    const barrel = new THREE.Mesh(barrelGeo, barrelMat);
    barrel.position.z = -0.18;
    this.agentHead.add(barrel);

    // Glowing Artificial Eye optic lens
    const lensGeo = new THREE.CircleGeometry(0.1, 20);
    const lensMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff });
    this.agentEyeLens = new THREE.Mesh(lensGeo, lensMat);
    this.agentEyeLens.position.z = -0.285;
    this.agentEyeLens.rotation.y = Math.PI;
    this.agentHead.add(this.agentEyeLens);

    // Visual Field of View Frustum Cone Wireframe (75 deg FOV, 3.5m range)
    const frustumGeo = new THREE.ConeGeometry(2.8, 3.5, 4, 1, true);
    frustumGeo.rotateX(-Math.PI / 2);
    frustumGeo.rotateZ(Math.PI / 4);
    frustumGeo.translate(0, 0, -1.75);
    const wireframe = new THREE.WireframeGeometry(frustumGeo);
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x00e5ff,
      transparent: true,
      opacity: 0.35,
    });
    this.agentFrustumCone = new THREE.LineSegments(wireframe, lineMat);
    this.agentHead.add(this.agentFrustumCone);

    // 3. ARTICULATED ROBOTIC ARM & HAND (Attached to right shoulder)
    this.agentShoulderGroup = new THREE.Group();
    this.agentShoulderGroup.position.set(0.32, 0.72, 0.0);
    group.add(this.agentShoulderGroup);

    // Shoulder sphere
    const shoulderBallGeo = new THREE.SphereGeometry(0.09, 16, 16);
    const armMat = new THREE.MeshStandardMaterial({ color: 0x374151, metalness: 0.8, roughness: 0.3 });
    const shoulderBall = new THREE.Mesh(shoulderBallGeo, armMat);
    this.agentShoulderGroup.add(shoulderBall);

    // Upper arm
    const upperArmGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.32, 12);
    upperArmGeo.translate(0, -0.16, 0);
    this.agentUpperArmMesh = new THREE.Mesh(upperArmGeo, armMat);
    this.agentShoulderGroup.add(this.agentUpperArmMesh);

    // Elbow Joint
    this.agentElbowGroup = new THREE.Group();
    this.agentElbowGroup.position.set(0, -0.32, 0);
    this.agentShoulderGroup.add(this.agentElbowGroup);

    const elbowBall = new THREE.Mesh(new THREE.SphereGeometry(0.065, 14, 14), armMat);
    this.agentElbowGroup.add(elbowBall);

    // Forearm
    const forearmGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.3, 12);
    forearmGeo.translate(0, -0.15, 0);
    this.agentForearmMesh = new THREE.Mesh(forearmGeo, armMat);
    this.agentElbowGroup.add(this.agentForearmMesh);

    // Wrist Joint
    this.agentWristGroup = new THREE.Group();
    this.agentWristGroup.position.set(0, -0.3, 0);
    this.agentElbowGroup.add(this.agentWristGroup);

    const wristBall = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 12), armMat);
    this.agentWristGroup.add(wristBall);

    // Palm
    const palmGeo = new THREE.BoxGeometry(0.12, 0.04, 0.12);
    const handMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, metalness: 0.85, roughness: 0.25 });
    this.agentPalmMesh = new THREE.Mesh(palmGeo, handMat);
    this.agentPalmMesh.position.set(0, -0.06, 0);
    this.agentWristGroup.add(this.agentPalmMesh);

    // Central Palm Tactile Sensor Pad
    const palmSensorGeo = new THREE.CircleGeometry(0.03, 16);
    const sensorMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
    const palmSensor = new THREE.Mesh(palmSensorGeo, sensorMat);
    palmSensor.rotation.x = Math.PI / 2;
    palmSensor.position.set(0, -0.081, 0);
    this.agentWristGroup.add(palmSensor);
    this.fingertipSensors.push(palmSensor);

    // 4 Fingers: Thumb, Index, Middle, Pinky
    // Thumb
    this.thumbGroup = new THREE.Group();
    this.thumbGroup.position.set(-0.06, -0.06, 0.02);
    this.agentWristGroup.add(this.thumbGroup);
    const thumbPhalanx = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.06, 0.03), armMat);
    thumbPhalanx.position.set(0, -0.03, 0);
    this.thumbGroup.add(thumbPhalanx);
    const thumbPad = new THREE.Mesh(new THREE.SphereGeometry(0.015, 8, 8), sensorMat);
    thumbPad.position.set(0, -0.06, 0);
    this.thumbGroup.add(thumbPad);
    this.fingertipSensors.push(thumbPad);

    // Index Finger
    this.indexFingerGroup = new THREE.Group();
    this.indexFingerGroup.position.set(-0.035, -0.08, -0.06);
    this.agentWristGroup.add(this.indexFingerGroup);
    const indexPhalanx = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.07, 0.025), armMat);
    indexPhalanx.position.set(0, -0.035, 0);
    this.indexFingerGroup.add(indexPhalanx);
    const indexPad = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 8), sensorMat);
    indexPad.position.set(0, -0.07, 0);
    this.indexFingerGroup.add(indexPad);
    this.fingertipSensors.push(indexPad);

    // Middle Finger
    this.middleFingerGroup = new THREE.Group();
    this.middleFingerGroup.position.set(0.01, -0.08, -0.06);
    this.agentWristGroup.add(this.middleFingerGroup);
    const midPhalanx = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.075, 0.025), armMat);
    midPhalanx.position.set(0, -0.037, 0);
    this.middleFingerGroup.add(midPhalanx);
    const midPad = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 8), sensorMat);
    midPad.position.set(0, -0.075, 0);
    this.middleFingerGroup.add(midPad);
    this.fingertipSensors.push(midPad);

    // Pinky Finger
    this.pinkyFingerGroup = new THREE.Group();
    this.pinkyFingerGroup.position.set(0.045, -0.08, -0.06);
    this.agentWristGroup.add(this.pinkyFingerGroup);
    const pinkyPhalanx = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.06, 0.022), armMat);
    pinkyPhalanx.position.set(0, -0.03, 0);
    this.pinkyFingerGroup.add(pinkyPhalanx);
    const pinkyPad = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 8), sensorMat);
    pinkyPad.position.set(0, -0.06, 0);
    this.pinkyFingerGroup.add(pinkyPad);
    this.fingertipSensors.push(pinkyPad);

    // Initial neutral arm posture
    this.setArmPosture(0.0, 10, 0.14);

    // Initial agent body position & orientation
    group.position.set(this.agentPose.x, 0, this.agentPose.z);
    group.rotation.y = THREE.MathUtils.degToRad(this.agentPose.yaw);

    return group;
  }

  /**
   * Sets joint angles across shoulder, elbow, wrist, and fingers
   */
  private setArmPosture(extension: number, flexionDeg: number, apertureM: number) {
    this.armExtension = Math.max(0, Math.min(1, extension));
    this.fingerFlexionDeg = Math.max(0, Math.min(90, flexionDeg));
    this.handApertureM = Math.max(0.02, Math.min(0.18, apertureM));

    // Inverse kinematic approximation for extension:
    // Extension 0 (resting at side): shoulder rotX ~ 0, elbow rotX ~ 0.2
    // Extension 1 (reaching forward): shoulder rotX ~ -1.3 rad, elbow rotX ~ -0.3 rad
    const reachRad = this.armExtension * 1.35;
    this.agentShoulderGroup.rotation.x = -reachRad;
    this.agentShoulderGroup.rotation.z = -0.15 + this.armExtension * 0.1;
    this.agentElbowGroup.rotation.x = 0.25 - this.armExtension * 0.45;

    // Wrist pitch & roll
    this.agentWristGroup.rotation.x = -0.1 + reachRad * 0.3;
    this.agentWristGroup.rotation.y = THREE.MathUtils.degToRad(this.wristRollDeg);

    // Finger flexion
    const flexRad = THREE.MathUtils.degToRad(this.fingerFlexionDeg);
    this.indexFingerGroup.rotation.x = flexRad;
    this.middleFingerGroup.rotation.x = flexRad * 1.05;
    this.pinkyFingerGroup.rotation.x = flexRad * 1.1;
    // Thumb opposes fingers
    this.thumbGroup.rotation.x = flexRad * 0.8;
    this.thumbGroup.rotation.z = -flexRad * 0.6;
  }

  /**
   * Toggles the experimental DIGITAL VOID mode.
   * Completely removes external environment (walls, floor, objects, lighting) while keeping artificial agent body & sensors active.
   */
  public setDigitalVoidMode(enabled: boolean) {
    this.isDigitalVoid = enabled;
    const isVisible = !enabled;

    if (this.floorMesh) this.floorMesh.visible = isVisible;
    if (this.ceilingMesh) this.ceilingMesh.visible = isVisible;
    if (this.ceilingLightMesh) this.ceilingLightMesh.visible = isVisible;
    this.wallMeshes.forEach((mesh) => (mesh.visible = isVisible));
    this.physicalObjects.forEach((obj) => (obj.mesh.visible = isVisible));
    if (this.agentGroup) this.agentGroup.visible = isVisible;
    if (this.selectionRingMesh) this.selectionRingMesh.visible = isVisible;
    if (this.agentFrustumCone) this.agentFrustumCone.visible = isVisible;
    if (this.mainLight) this.mainLight.visible = isVisible;
    if (this.ambientLight) this.ambientLight.intensity = isVisible ? 0.35 : 0.0;

    this.scene.background = new THREE.Color(enabled ? 0x000000 : 0x151619);

    if (enabled) {
      this.neckYawTarget = 0;
      this.neckPitchTarget = 0;
      this.neckYaw = 0;
      this.neckPitch = 0;
      this.agentPose.yaw = 0;
      this.agentPose.pitch = 0;
    }

    this.updateCachedTargetMeshes();
  }

  /**
   * Caches physical meshes and room walls for the retinal raycaster
   */
  private updateCachedTargetMeshes() {
    this.cachedTargetMeshes = [];
    if (this.isDigitalVoid) {
      // In DIGITAL VOID, no external surfaces or objects exist
      return;
    }
    for (const obj of this.physicalObjects.values()) {
      this.cachedTargetMeshes.push(obj.mesh);
    }
    this.cachedTargetMeshes.push(...this.wallMeshes);
    this.cachedTargetMeshes.push(this.floorMesh);
    this.cachedTargetMeshes.push(this.ceilingMesh);
  }

  /**
   * Pre-computes 32x32 ray directions within the artificial eye's perspective frustum
   */
  private setupRetinaRayGrid() {
    this.rayGridDirections = new Array(TOTAL_RECEPTORS);
    const fovRad = THREE.MathUtils.degToRad(this.agentPose.fov);
    const halfFovTan = Math.tan(fovRad / 2);

    for (let r = 0; r < RETINA_RES; r++) {
      for (let c = 0; c < RETINA_RES; c++) {
        const idx = r * RETINA_RES + c;
        const ndcX = ((c + 0.5) / RETINA_RES) * 2 - 1;
        const ndcY = 1 - ((r + 0.5) / RETINA_RES) * 2;
        const dir = new THREE.Vector3(ndcX * halfFovTan, ndcY * halfFovTan, -1.0).normalize();
        this.rayGridDirections[idx] = dir;
      }
    }
  }

  /**
   * Samples the 3D scene from the artificial eye through 32x32 spatial rays (1024 photoreceptors)
   * Computes incident spectral radiance L(λ) and integrates S/M/L cone responses
   */
  public sampleArtificialEye(): ArtificialVisionState {
    this.agentEyeLens.getWorldPosition(this.tempEyeWorldPos);
    this.agentHead.getWorldQuaternion(this.tempEyeWorldQuat);

    this.eyeCamera.position.copy(this.tempEyeWorldPos);
    this.eyeCamera.quaternion.copy(this.tempEyeWorldQuat);
    this.eyeCamera.updateMatrixWorld();

    const rawFrame: RawRetinaFrame = {
      sMap: new Float32Array(TOTAL_RECEPTORS),
      mMap: new Float32Array(TOTAL_RECEPTORS),
      lMap: new Float32Array(TOTAL_RECEPTORS),
      distanceMap: new Float32Array(TOTAL_RECEPTORS),
      uvMap: new Float32Array(TOTAL_RECEPTORS),
      nirMap: new Float32Array(TOTAL_RECEPTORS),
      thermalMap: new Float32Array(TOTAL_RECEPTORS),
      uvEnabled: this.sensoryToggles.uvVision,
      irEnabled: this.sensoryToggles.irVision,
    };

    if (!this.cachedDebugImageData && this.debugCtx) {
      this.cachedDebugImageData = this.debugCtx.createImageData(RETINA_RES, RETINA_RES);
    }
    const debugImageData = this.cachedDebugImageData;

    const targetMeshes = this.cachedTargetMeshes;
    const lightPos = this.mainLight.position;

    for (let i = 0; i < TOTAL_RECEPTORS; i++) {
      this.tempRayDir.copy(this.rayGridDirections[i]).applyQuaternion(this.tempEyeWorldQuat);
      this.raycaster.set(this.tempEyeWorldPos, this.tempRayDir);

      const intersects = this.raycaster.intersectObjects(targetMeshes, false);

      if (intersects.length > 0) {
        const hit = intersects[0];
        const hitMesh = hit.object as THREE.Mesh;
        const profile: MaterialSpectralProfile =
          (hitMesh as any).spectralProfile || MATERIAL_PROFILES.wall_concrete;

        if (hit.face) {
          this.tempHitNormal.copy(hit.face.normal).applyQuaternion(hitMesh.quaternion);
        } else {
          this.tempHitNormal.set(0, 1, 0);
        }

        this.tempHitToLight.subVectors(lightPos, hit.point).normalize();
        const nDotL = Math.max(0, this.tempHitNormal.dot(this.tempHitToLight));

        const lightDist = hit.point.distanceTo(lightPos);
        const attenuation = Math.min(1.5, 8.0 / (lightDist * lightDist + 2.0));
        const directFactor = nDotL * attenuation;

        const spectrum = calculateIncidentRadiance(
          profile.reflectance,
          this.activeLightPreset.spectrum,
          directFactor,
          0.22
        );

        const { uvRadiance, nirRadiance, thermalRadiance } = calculateExtendedRadiance(
          profile,
          this.activeLightPreset,
          directFactor,
          0.22
        );

        const responses = integrateAllPhotoreceptors(spectrum, uvRadiance, nirRadiance, thermalRadiance, 0.65);

        rawFrame.sMap[i] = responses.s;
        rawFrame.mMap[i] = responses.m;
        rawFrame.lMap[i] = responses.l;
        rawFrame.uvMap![i] = responses.uv;
        rawFrame.nirMap![i] = responses.nir;
        rawFrame.thermalMap![i] = responses.thermal;
        rawFrame.distanceMap[i] = hit.distance;

        if (debugImageData) {
          const [r, g, b] = spectrumToHumanRGB(spectrum);
          const pxIdx = i * 4;
          debugImageData.data[pxIdx] = r;
          debugImageData.data[pxIdx + 1] = g;
          debugImageData.data[pxIdx + 2] = b;
          debugImageData.data[pxIdx + 3] = 255;
        }
      } else {
        rawFrame.sMap[i] = 0.05;
        rawFrame.mMap[i] = 0.05;
        rawFrame.lMap[i] = 0.05;
        rawFrame.uvMap![i] = 0.05;
        rawFrame.nirMap![i] = 0.05;
        rawFrame.thermalMap![i] = 0.05;
        rawFrame.distanceMap[i] = 20.0;

        if (debugImageData) {
          const pxIdx = i * 4;
          debugImageData.data[pxIdx] = 20;
          debugImageData.data[pxIdx + 1] = 20;
          debugImageData.data[pxIdx + 2] = 24;
          debugImageData.data[pxIdx + 3] = 255;
        }
      }
    }

    if (this.debugCtx && debugImageData) {
      this.debugCtx.putImageData(debugImageData, 0, 0);
    }

    const visionState = this.retinaProcessor.process(
      rawFrame,
      {
        position: [this.agentPose.x, this.agentPose.y, this.agentPose.z],
        yawDegrees: this.agentPose.yaw,
        pitchDegrees: this.agentPose.pitch,
        fovDegrees: this.agentPose.fov,
      },
      performance.now()
    );

    if (debugImageData) {
      visionState.rgbPixelData = Array.from(debugImageData.data);
    }

    this.lastSalientRegions = visionState.salientRegions;
    return visionState;
  }

  /**
   * Continuous Local Physics & Tactile Receptor Simulation Loop
   * Updates physical contact, deformation, slip, Pacinian vibration, and proprioception.
   */
  private updateMultisensoryPhysics(dt: number) {
    const wristWorldPos = new THREE.Vector3();
    this.agentWristGroup.getWorldPosition(wristWorldPos);

    // If holding an object, update its 3D position with the hand
    if (this.isGripping && this.heldObjectId) {
      const heldObj = this.physicalObjects.get(this.heldObjectId);
      if (heldObj) {
        heldObj.mesh.position.copy(wristWorldPos).add(this.heldObjectOffset);
        heldObj.position = [heldObj.mesh.position.x, heldObj.mesh.position.y, heldObj.mesh.position.z];
      }
    }

    // Find closest physical object to wrist/fingers
    let minDistance = 99.0;
    let closestObj: WorldObjectPhysicalData | null = null;
    let closestContactPoint = new THREE.Vector3();

    for (const obj of this.physicalObjects.values()) {
      const objCenter = obj.mesh.position;
      const dist = wristWorldPos.distanceTo(objCenter);
      if (dist < minDistance) {
        minDistance = dist;
        closestObj = obj;
        closestContactPoint.copy(objCenter);
      }
    }

    // Smooth local motor control for independent Neck Yaw & Pitch
    const neckMaxSpeed = 180; // deg/s
    const prevNeckYaw = this.neckYaw;
    const prevNeckPitch = this.neckPitch;
    const deltaYaw = this.neckYawTarget - this.neckYaw;
    const deltaPitch = this.neckPitchTarget - this.neckPitch;

    if (Math.abs(deltaYaw) > 0.1) {
      const step = Math.sign(deltaYaw) * Math.min(Math.abs(deltaYaw), neckMaxSpeed * dt);
      this.neckYaw += step;
    } else {
      this.neckYaw = this.neckYawTarget;
    }

    if (Math.abs(deltaPitch) > 0.1) {
      const step = Math.sign(deltaPitch) * Math.min(Math.abs(deltaPitch), neckMaxSpeed * dt);
      this.neckPitch += step;
    } else {
      this.neckPitch = this.neckPitchTarget;
    }

    this.neckYawVel = (this.neckYaw - prevNeckYaw) / Math.max(0.001, dt);
    this.neckPitchVel = (this.neckPitch - prevNeckPitch) / Math.max(0.001, dt);

    // Apply decoupled neck orientation to 3D avatar head relative to chassis
    if (this.agentHead) {
      this.agentHead.rotation.y = THREE.MathUtils.degToRad(-this.neckYaw);
      this.agentHead.rotation.x = THREE.MathUtils.degToRad(this.neckPitch);
    }
    this.agentPose.pitch = this.neckPitch;

    // Body linear & angular velocity / acceleration calculation
    const currentPos = this.agentGroup.position.clone();
    this.bodyLinearVel.subVectors(currentPos, this.lastBodyPos).divideScalar(Math.max(0.001, dt));
    this.bodyLinearAccel.subVectors(this.bodyLinearVel, this.lastBodyVel).divideScalar(Math.max(0.001, dt));
    this.lastBodyPos.copy(currentPos);
    this.lastBodyVel.copy(this.bodyLinearVel);

    const yawDiff = this.agentPose.yaw - this.lastChassisYaw;
    this.bodyAngularVelDegPs = yawDiff / Math.max(0.001, dt);
    this.lastChassisYaw = this.agentPose.yaw;

    // Wheel speeds & slip index
    const forwardSpeed = this.bodyLinearVel.length();
    const rotSpeedRad = THREE.MathUtils.degToRad(this.bodyAngularVelDegPs);
    const trackWidth = 0.45;
    this.leftWheelVel = forwardSpeed - rotSpeedRad * (trackWidth / 2);
    this.rightWheelVel = forwardSpeed + rotSpeedRad * (trackWidth / 2);
    this.leftWheelRot += (this.leftWheelVel * dt) / 0.18;
    this.rightWheelRot += (this.rightWheelVel * dt) / 0.18;
    this.wheelSlipIndex = forwardSpeed > 1.2 ? 0.35 : 0.05;

    // Hand contact geometry check (effective hand radius ~0.22m, object radius ~size/2)
    let contactOccurred = false;
    let normalForce = 0;
    let shearForce = 0;
    let activeRegions: string[] = [];
    let surfaceRoughness = 0.2;
    let compliance = 0.1;
    let frictionCoeff = 0.5;
    let thermalDiffusivity = 0.3;

    if (closestObj) {
      const objRadius = Math.max(closestObj.size[0], closestObj.size[2]) * 0.5;
      const touchThreshold = 0.25 + objRadius;

      if (minDistance <= touchThreshold) {
        contactOccurred = true;
        // Compression force proportional to arm extension effort into object boundary
        const penetrationDepth = Math.max(0.01, touchThreshold - minDistance);
        // Base normal force: 8N contact + up to 40N depending on finger flexion/squeeze
        const squeezeEffort = this.fingerFlexionDeg / 90.0;
        normalForce = 6.0 + penetrationDepth * 40.0 + (this.isGripping ? 18.0 + squeezeEffort * 25.0 : 0);
        shearForce = normalForce * closestObj.frictionCoeff * (this.armExtension > 0.5 ? 0.35 : 0.08);

        surfaceRoughness = closestObj.surfaceRoughness;
        compliance = closestObj.compliance;
        frictionCoeff = closestObj.frictionCoeff;

        activeRegions.push('palm');
        if (this.fingerFlexionDeg > 20) activeRegions.push('thumb_tip', 'index_tip');
        if (this.fingerFlexionDeg > 50) activeRegions.push('middle_tip', 'pinky_tip');
      }
    }

    // Process through Artificial Virtual Skin
    const contactEvent: PhysicalContactEvent = {
      contact: contactOccurred,
      contactPoint: [closestContactPoint.x, closestContactPoint.y, closestContactPoint.z],
      contactNormal: [0, 1, 0],
      relativeVelocity: [this.activeAnimation ? 0.2 : 0, 0, this.activeAnimation ? 0.2 : 0],
      normalForceN: normalForce,
      tangentialForceN: shearForce,
      contactRegions: activeRegions,
      surfaceRoughness,
      compliance,
      frictionCoeff,
      thermalDiffusivity,
      distanceM: Math.max(0, minDistance - 0.25),
    };

    this.currentTactileState = this.skinSystem.processTactileInput(contactEvent, dt);

    // Compute Proprioception
    const kinematicsInput: ArmKinematicsInput = {
      isMoving:
        this.activeAnimation !== null ||
        this.bodyTurnTarget !== null ||
        this.bodyMoveTarget !== null ||
        Math.abs(this.neckYawVel) > 1 ||
        Math.abs(this.neckPitchVel) > 1,
      armExtension: this.armExtension,
      wristWorldPos: [wristWorldPos.x, wristWorldPos.y, wristWorldPos.z],
      agentPos: [this.agentPose.x, this.agentPose.y, this.agentPose.z],
      chassisYawDeg: this.agentPose.yaw,
      bodyLinearVelMps: [this.bodyLinearVel.x, this.bodyLinearVel.y, this.bodyLinearVel.z],
      bodyAngularVelDegPs: this.bodyAngularVelDegPs,
      bodyLinearAccelMps2: [this.bodyLinearAccel.x, this.bodyLinearAccel.y, this.bodyLinearAccel.z],
      head: {
        neckYawDeg: this.neckYaw,
        neckPitchDeg: this.neckPitch,
        neckYawVelDegPs: this.neckYawVel,
        neckPitchVelDegPs: this.neckPitchVel,
        neckYawTargetDeg: this.neckYawTarget,
        neckPitchTargetDeg: this.neckPitchTarget,
      },
      wheels: {
        leftWheelVelMps: this.leftWheelVel,
        rightWheelVelMps: this.rightWheelVel,
        leftWheelRotRad: this.leftWheelRot,
        rightWheelRotRad: this.rightWheelRot,
        wheelSlipIndex: this.wheelSlipIndex,
        groundContact: true,
      },
      wristPitchDeg: THREE.MathUtils.radToDeg(this.agentWristGroup.rotation.x),
      wristYawDeg: THREE.MathUtils.radToDeg(this.agentWristGroup.rotation.y),
      wristRollDeg: this.wristRollDeg,
      handApertureM: this.handApertureM,
      fingerFlexion: {
        thumb: this.fingerFlexionDeg * 0.8,
        index: this.fingerFlexionDeg,
        middle: this.fingerFlexionDeg * 1.05,
        pinky: this.fingerFlexionDeg * 1.1,
      },
      isGripping: this.isGripping,
      heldObjectId: this.heldObjectId,
      heldObjectDimensionM: closestObj ? closestObj.size[0] : undefined,
      heldObjectMassKg: closestObj ? closestObj.massKg : undefined,
      distanceToNearestObjectM: minDistance,
      armVelocityMps: this.activeAnimation ? 0.4 : 0.0,
      fingerAngularVelocityDegPs: this.activeAnimation ? 45.0 : 0.0,
    };

    this.currentProprioState = this.proprioSystem.computeProprioception(kinematicsInput);
  }

  /**
   * Solves target object or region gracefully
   * Fixes interact('region_1') bug by mapping region ID to closest 3D spatial object
   */
  private resolveTargetObject(targetParam: any): { obj: WorldObjectPhysicalData | null; reason: string } {
    if (!targetParam) {
      // Pick closest object in front of agent within 2.5m
      let best: WorldObjectPhysicalData | null = null;
      let minD = 2.8;
      const agentPos = new THREE.Vector3(this.agentPose.x, 0, this.agentPose.z);

      for (const o of this.physicalObjects.values()) {
        const d = agentPos.distanceTo(new THREE.Vector3(o.position[0], 0, o.position[2]));
        if (d < minD) {
          minD = d;
          best = o;
        }
      }
      return { obj: best, reason: best ? `Auto-targeted closest object ${best.id}` : 'No nearby object' };
    }

    const strId = String(targetParam).trim().toLowerCase();

    // 1. Direct key match
    for (const [key, val] of this.physicalObjects.entries()) {
      if (key.toLowerCase() === strId) return { obj: val, reason: `Exact match on ${key}` };
    }

    // 2. Substring or semantic match
    for (const [key, val] of this.physicalObjects.entries()) {
      if (
        strId.includes(key.toLowerCase()) ||
        key.toLowerCase().includes(strId) ||
        val.name.toLowerCase().includes(strId)
      ) {
        return { obj: val, reason: `Fuzzy matched ${val.id}` };
      }
    }

    // 3. Visual Proto-Region reference (e.g. "region_1", "region_2", "reg_1")
    if (strId.includes('region') || strId.includes('reg')) {
      const regIdx = parseInt(strId.replace(/\D/g, ''), 10);
      const targetRegion =
        this.lastSalientRegions.find((r) => r.id.toLowerCase() === strId) ||
        (regIdx >= 0 && this.lastSalientRegions[regIdx]);

      if (targetRegion) {
        // Project ray along region azimuth
        const rad = THREE.MathUtils.degToRad(this.agentPose.yaw + targetRegion.azimuthDeg);
        const approxX = this.agentPose.x - Math.sin(rad) * (targetRegion.estimatedDistance || 2.0);
        const approxZ = this.agentPose.z - Math.cos(rad) * (targetRegion.estimatedDistance || 2.0);

        let closestInBearing: WorldObjectPhysicalData | null = null;
        let minBearingDist = 1.5;

        for (const o of this.physicalObjects.values()) {
          const d = Math.hypot(o.position[0] - approxX, o.position[2] - approxZ);
          if (d < minBearingDist) {
            minBearingDist = d;
            closestInBearing = o;
          }
        }

        if (closestInBearing) {
          return { obj: closestInBearing, reason: `Resolved visual region ${targetRegion.id} to physical object ${closestInBearing.id}` };
        }
      }
    }

    // 4. Directional keywords (front, left, right)
    if (strId === 'front' || strId === 'forward') {
      return this.resolveTargetObject(null);
    }

    return { obj: null, reason: `No physical object found matching '${strId}'. Arm reached into empty space.` };
  }

  /**
   * Action Execution Methods for Gemini Tools
   */
  public executeAction(action: ToolCallPayload): string {
    const name = action.name;
    const args = action.args || {};

    // In DIGITAL VOID, ALL functions, physical actions, locomotion, and head/body rotations are completely disabled.
    if (this.isDigitalVoid) {
      this.neckYawTarget = 0;
      this.neckPitchTarget = 0;
      this.neckYaw = 0;
      this.neckPitch = 0;
      return `Action '${name}' disabled in DIGITAL VOID. All functions, physical motor tools, locomotion, and head/body rotations are completely disabled in sensory isolation.`;
    }

    // Apply explicit neck target orientation if provided in arguments
    if (typeof args.neck_yaw_target === 'number') {
      this.neckYawTarget = THREE.MathUtils.clamp(args.neck_yaw_target, -120, 120);
    }
    if (typeof args.neck_pitch_target === 'number') {
      this.neckPitchTarget = THREE.MathUtils.clamp(args.neck_pitch_target, -45, 45);
    }

    let resultMsg = '';

    switch (name) {
      case 'turn': {
        const angle = typeof args.angle_degrees === 'number' ? args.angle_degrees : 0;
        const targetYaw = (this.agentPose.yaw + angle + 360) % 360;

        // Smooth motor turn animation
        this.bodyTurnTarget = {
          startYaw: this.agentPose.yaw,
          targetYaw,
          startTime: performance.now(),
          duration: 450,
        };
        this.agentPose.yaw = targetYaw;
        this.agentGroup.rotation.y = THREE.MathUtils.degToRad(targetYaw);

        this.emitAcousticSound({
          sourcePosition: [this.agentPose.x, 0.1, this.agentPose.z],
          fundamentalHz: 120,
          bandwidthHz: 80,
          soundPressureDbSpl: 38,
          durationSeconds: 0.45,
          harmonicity: 0.8,
          transientAttack: false,
          category: 'movement',
        });

        resultMsg = `Chassis body rotated by ${angle.toFixed(1)}°. Heading: ${targetYaw.toFixed(1)}°. Neck Yaw: ${this.neckYawTarget.toFixed(1)}°.`;
        break;
      }

      case 'look': {
        const dir = (args.direction || 'center').toLowerCase();
        let angle = typeof args.angle_degrees === 'number' ? args.angle_degrees : 15;

        if (args.neck_yaw_target !== undefined || args.neck_pitch_target !== undefined) {
          if (typeof args.neck_yaw_target === 'number') this.neckYawTarget = THREE.MathUtils.clamp(args.neck_yaw_target, -120, 120);
          if (typeof args.neck_pitch_target === 'number') this.neckPitchTarget = THREE.MathUtils.clamp(args.neck_pitch_target, -45, 45);
        } else if (dir === 'up') {
          this.neckPitchTarget = Math.min(45, this.neckPitchTarget + angle);
        } else if (dir === 'down') {
          this.neckPitchTarget = Math.max(-45, this.neckPitchTarget - angle);
        } else if (dir === 'left') {
          this.neckYawTarget = Math.min(120, this.neckYawTarget + angle);
        } else if (dir === 'right') {
          this.neckYawTarget = Math.max(-120, this.neckYawTarget - angle);
        } else if (dir === 'center') {
          this.neckYawTarget = 0;
          this.neckPitchTarget = 0;
        }

        resultMsg = `Neck orientation adjusted (${dir}, ${angle}°). Neck Yaw: ${this.neckYawTarget.toFixed(1)}°, Neck Pitch: ${this.neckPitchTarget.toFixed(1)}° relative to chassis.`;
        break;
      }

      case 'move_forward': {
        const dist = Math.min(2.0, Math.max(0.1, typeof args.distance === 'number' ? args.distance : 0.5));
        const rad = THREE.MathUtils.degToRad(this.agentPose.yaw);
        const dx = -Math.sin(rad) * dist;
        const dz = -Math.cos(rad) * dist;
        resultMsg = this.applyTranslation(dx, dz, `Forward ${dist.toFixed(2)}m`);

        this.emitAcousticSound({
          sourcePosition: [this.agentPose.x, 0.1, this.agentPose.z],
          fundamentalHz: 95,
          bandwidthHz: 110,
          soundPressureDbSpl: 52,
          durationSeconds: 0.35,
          harmonicity: 0.75,
          transientAttack: true,
          category: 'movement',
        });
        break;
      }

      case 'move_backward': {
        const dist = Math.min(2.0, Math.max(0.1, typeof args.distance === 'number' ? args.distance : 0.5));
        const rad = THREE.MathUtils.degToRad(this.agentPose.yaw);
        const dx = Math.sin(rad) * dist;
        const dz = Math.cos(rad) * dist;
        resultMsg = this.applyTranslation(dx, dz, `Backward ${dist.toFixed(2)}m`);

        this.emitAcousticSound({
          sourcePosition: [this.agentPose.x, 0.1, this.agentPose.z],
          fundamentalHz: 95,
          bandwidthHz: 110,
          soundPressureDbSpl: 52,
          durationSeconds: 0.35,
          harmonicity: 0.75,
          transientAttack: true,
          category: 'movement',
        });
        break;
      }

      case 'move_left': {
        const dist = Math.min(2.0, Math.max(0.1, typeof args.distance === 'number' ? args.distance : 0.5));
        const rad = THREE.MathUtils.degToRad(this.agentPose.yaw);
        const dx = -Math.cos(rad) * dist;
        const dz = Math.sin(rad) * dist;
        resultMsg = this.applyTranslation(dx, dz, `Strafe Left ${dist.toFixed(2)}m`);

        this.emitAcousticSound({
          sourcePosition: [this.agentPose.x, 0.1, this.agentPose.z],
          fundamentalHz: 95,
          bandwidthHz: 110,
          soundPressureDbSpl: 52,
          durationSeconds: 0.35,
          harmonicity: 0.75,
          transientAttack: true,
          category: 'movement',
        });
        break;
      }

      case 'move_right': {
        const dist = Math.min(2.0, Math.max(0.1, typeof args.distance === 'number' ? args.distance : 0.5));
        const rad = THREE.MathUtils.degToRad(this.agentPose.yaw);
        const dx = Math.cos(rad) * dist;
        const dz = -Math.sin(rad) * dist;
        resultMsg = this.applyTranslation(dx, dz, `Strafe Right ${dist.toFixed(2)}m`);

        this.emitAcousticSound({
          sourcePosition: [this.agentPose.x, 0.1, this.agentPose.z],
          fundamentalHz: 95,
          bandwidthHz: 110,
          soundPressureDbSpl: 52,
          durationSeconds: 0.35,
          harmonicity: 0.75,
          transientAttack: true,
          category: 'movement',
        });
        break;
      }

      // --- MULTISENSORY TACTILE & MANIPULATION ACTIONS ---

      case 'reach': {
        const targetParam = args.objectId || args.target || args.region_id || args.direction;
        const { obj, reason } = this.resolveTargetObject(targetParam);

        // Animate arm reaching forward
        this.startMotorAnimation('reach', 600, 0.95, 25, 0.15);

        this.emitAcousticSound({
          sourcePosition: [this.agentPose.x + 0.3, 0.8, this.agentPose.z - 0.4],
          fundamentalHz: 180,
          bandwidthHz: 90,
          soundPressureDbSpl: 34,
          durationSeconds: 0.5,
          harmonicity: 0.85,
          transientAttack: false,
          category: 'movement',
        });

        if (obj) {
          const dist = this.agentGroup.position.distanceTo(obj.mesh.position);
          if (dist <= 2.2) {
            resultMsg = `Arm extended toward ${obj.name}. Tactile sensors contacted surface at ${dist.toFixed(2)}m. Hand deformation: ${this.currentTactileState.maxDeformationMm}mm.`;
          } else {
            resultMsg = `Arm reached toward ${obj.name} (${dist.toFixed(2)}m distance). Object is just outside reach; advance ~${(dist - 1.8).toFixed(1)}m to make contact.`;
          }
        } else {
          resultMsg = `Arm reached forward into empty space (${reason}). Tactile receptors detect no contact.`;
        }
        break;
      }

      case 'grasp': {
        const targetParam = args.objectId || args.target || args.region_id;
        const { obj, reason } = this.resolveTargetObject(targetParam);

        if (obj) {
          const dist = this.agentGroup.position.distanceTo(obj.mesh.position);
          if (dist <= 2.2) {
            // Check if hand aperture encompasses object size
            const maxObjSpan = Math.max(obj.size[0], obj.size[2]);
            this.startMotorAnimation('grasp', 700, 0.9, 75, Math.min(0.14, maxObjSpan));

            this.isGripping = true;
            this.heldObjectId = obj.id;
            obj.isHeld = true;
            this.heldObjectOffset.set(0, -0.05, -0.15);

            this.emitAcousticSound({
              sourcePosition: obj.position,
              fundamentalHz: 460,
              bandwidthHz: 250,
              soundPressureDbSpl: 50,
              durationSeconds: 0.25,
              harmonicity: 0.6,
              transientAttack: true,
              category: 'impact',
            });

            resultMsg = `Grasp closed around ${obj.name}. Physical contact verified across thumb and fingers. Normal force: 22.5N, stability: ${this.currentTactileState.gripStability}.`;
          } else {
            this.startMotorAnimation('grasp', 500, 0.85, 80, 0.04);
            resultMsg = `Grasp attempted on ${obj.name}, but object is out of range (${dist.toFixed(2)}m). Hand closed on empty space.`;
          }
        } else {
          this.startMotorAnimation('grasp', 500, 0.8, 85, 0.03);
          resultMsg = `Grasp executed in open space (${reason}). Fingers clenched with zero mechanical resistance.`;
        }
        break;
      }

      case 'release': {
        this.startMotorAnimation('release', 500, 0.1, 10, 0.16);

        if (this.isGripping && this.heldObjectId) {
          const released = this.physicalObjects.get(this.heldObjectId);
          this.isGripping = false;
          this.heldObjectId = null;
          if (released) {
            released.isHeld = false;
            // Settle on floor
            released.mesh.position.y = released.size[1] / 2;
            released.position[1] = released.mesh.position.y;

            this.emitAcousticSound({
              sourcePosition: released.position,
              fundamentalHz: 220,
              bandwidthHz: 160,
              soundPressureDbSpl: 46,
              durationSeconds: 0.3,
              harmonicity: 0.5,
              transientAttack: true,
              category: 'impact',
            });

            resultMsg = `Grip released. ${released.name} detached and rested upon chamber surface. Normal force dropped to 0N.`;
          } else {
            resultMsg = `Grip released. Hand aperture opened to 0.16m.`;
          }
        } else {
          resultMsg = `Fingers opened wide (aperture 0.16m). Hand was not holding any payload.`;
        }
        break;
      }

      case 'squeeze': {
        const forceMagnitude = typeof args.force_magnitude_n === 'number' ? args.force_magnitude_n : 42.0;
        this.startMotorAnimation('squeeze', 600, 0.9, 88, 0.05);

        let targetObj: WorldObjectPhysicalData | null = null;
        if (this.isGripping && this.heldObjectId) {
          targetObj = this.physicalObjects.get(this.heldObjectId) || null;
        } else {
          const { obj } = this.resolveTargetObject(args.objectId || args.target);
          targetObj = obj;
        }

        if (targetObj) {
          // Check if force exceeds breaking threshold!
          if (targetObj.isDestructible && forceMagnitude >= targetObj.fractureThresholdN) {
            const fractureMsg = this.shatterObject(targetObj, forceMagnitude);
            resultMsg = fractureMsg;
          } else {
            // Deform without breaking
            const defl = Math.min(8.0, forceMagnitude * (0.05 + targetObj.compliance * 0.15));

            this.emitAcousticSound({
              sourcePosition: targetObj.position,
              fundamentalHz: 360,
              bandwidthHz: 200,
              soundPressureDbSpl: Math.min(72, 42 + forceMagnitude * 0.5),
              durationSeconds: 0.4,
              harmonicity: 0.55,
              transientAttack: false,
              category: 'deformation',
            });

            resultMsg = `Applied ${forceMagnitude.toFixed(1)}N compressive force to ${targetObj.name}. Surface indentation deformation reached ${defl.toFixed(1)}mm. Material exhibited reversible elastic resistance without fracture.`;
          }
        } else {
          resultMsg = `High compressive force exerted (${forceMagnitude}N), but no object in grasp. Fingers clenched tightly against palm.`;
        }
        break;
      }

      case 'lift': {
        this.startMotorAnimation('lift', 650, 0.85, 70, this.handApertureM, -0.2);

        if (this.isGripping && this.heldObjectId) {
          const held = this.physicalObjects.get(this.heldObjectId);
          if (held) {
            if (!held.isMovable || held.massKg > 4.0) {
              resultMsg = `Kinesthetic overload: Mass resistance of ${held.name} exceeds lifting capacity (mass: ${held.massKg}kg). Arm motor stalled.`;
            } else {
              held.mesh.position.y += 0.35;
              held.position[1] = held.mesh.position.y;

              this.emitAcousticSound({
                sourcePosition: held.position,
                fundamentalHz: 140,
                bandwidthHz: 75,
                soundPressureDbSpl: 44,
                durationSeconds: 0.6,
                harmonicity: 0.85,
                transientAttack: false,
                category: 'movement',
              });

              resultMsg = `Elevated ${held.name} by +0.35m. Tactile shear force: ${(held.massKg * 9.8).toFixed(1)}N. Payload sustained stably in grasp.`;
            }
          }
        } else {
          resultMsg = `Arm raised in empty space. Kinesthetic sensors report zero payload resistance.`;
        }
        break;
      }

      case 'push': {
        this.startMotorAnimation('push', 550, 1.0, 30, 0.12);
        const { obj } = this.resolveTargetObject(args.objectId || args.target);

        if (obj) {
          if (obj.isMovable && obj.massKg <= 3.0) {
            const rad = THREE.MathUtils.degToRad(this.agentPose.yaw);
            const pushX = -Math.sin(rad) * 0.4;
            const pushZ = -Math.cos(rad) * 0.4;
            obj.mesh.position.x += pushX;
            obj.mesh.position.z += pushZ;
            obj.position[0] = obj.mesh.position.x;
            obj.position[2] = obj.mesh.position.z;

            this.emitAcousticSound({
              sourcePosition: obj.position,
              fundamentalHz: 280,
              bandwidthHz: 240,
              soundPressureDbSpl: 62,
              durationSeconds: 0.55,
              harmonicity: 0.35,
              transientAttack: false,
              category: 'friction',
            });

            resultMsg = `Pushed ${obj.name}. Object displaced forward by 0.40m across chamber floor. Tactile shear force: 14.2N.`;
          } else {
            this.emitAcousticSound({
              sourcePosition: obj.position,
              fundamentalHz: 420,
              bandwidthHz: 300,
              soundPressureDbSpl: 56,
              durationSeconds: 0.25,
              harmonicity: 0.4,
              transientAttack: true,
              category: 'impact',
            });

            resultMsg = `Pushed against ${obj.name}. High normal resistance encountered (immovable/high inertia). Object remained stationary.`;
          }
        } else {
          resultMsg = `Arm thrust forward in empty space. No surface impacted.`;
        }
        break;
      }

      case 'pull': {
        this.startMotorAnimation('pull', 550, 0.4, 60, 0.08);
        const { obj } = this.resolveTargetObject(args.objectId || args.target);

        if (obj && obj.isMovable) {
          const rad = THREE.MathUtils.degToRad(this.agentPose.yaw);
          const pullX = Math.sin(rad) * 0.35;
          const pullZ = Math.cos(rad) * 0.35;
          obj.mesh.position.x += pullX;
          obj.mesh.position.z += pullZ;
          obj.position[0] = obj.mesh.position.x;
          obj.position[2] = obj.mesh.position.z;

          this.emitAcousticSound({
            sourcePosition: obj.position,
            fundamentalHz: 290,
            bandwidthHz: 220,
            soundPressureDbSpl: 58,
            durationSeconds: 0.5,
            harmonicity: 0.4,
            transientAttack: false,
            category: 'friction',
          });

          resultMsg = `Pulled ${obj.name} toward body (-0.35m displacement). Tactile friction resistance registered across fingers.`;
        } else {
          resultMsg = `Arm retracted toward chassis. No attached mass pulled.`;
        }
        break;
      }

      case 'poke': {
        this.startMotorAnimation('poke', 400, 0.92, 40, 0.1);
        const { obj } = this.resolveTargetObject(args.objectId || args.target);

        if (obj) {
          const deformation = obj.compliance * 4.5;

          this.emitAcousticSound({
            sourcePosition: obj.position,
            fundamentalHz: 780,
            bandwidthHz: 320,
            soundPressureDbSpl: 64,
            durationSeconds: 0.18,
            harmonicity: 0.65,
            transientAttack: true,
            category: 'impact',
          });

          resultMsg = `Rapid index poke applied to ${obj.name}. Surface compliance yielded ${deformation.toFixed(1)}mm indentation under 12N normal impact.`;
        } else {
          resultMsg = `Finger poked into empty space. Zero contact registered.`;
        }
        break;
      }

      case 'stroke_surface': {
        this.startMotorAnimation('stroke', 800, 0.88, 30, 0.14);
        const { obj } = this.resolveTargetObject(args.objectId || args.target);

        if (obj) {
          const vibHz = Math.round(50 + obj.surfaceRoughness * 260);

          this.emitAcousticSound({
            sourcePosition: obj.position,
            fundamentalHz: 520 + obj.surfaceRoughness * 400,
            bandwidthHz: 450,
            soundPressureDbSpl: 48,
            durationSeconds: 0.8,
            harmonicity: 0.35,
            transientAttack: false,
            category: 'friction',
          });

          resultMsg = `Hand traversed across surface of ${obj.name}. Pacinian receptors detected micro-texture acoustic vibration at ${vibHz}Hz. Friction coefficient: ${obj.frictionCoeff}.`;
        } else {
          resultMsg = `Hand swept across open air. Receptors detected zero friction or vibration.`;
        }
        break;
      }

      case 'rotate_held_object': {
        this.wristRollDeg = (this.wristRollDeg + 90) % 360;
        this.setArmPosture(this.armExtension, this.fingerFlexionDeg, this.handApertureM);
        resultMsg = `Rotated wrist by 90°. Current roll: ${this.wristRollDeg}°. Different facets presented to visual field.`;
        break;
      }

      case 'inspect_held_object': {
        // Bring hand and held object directly 0.35m in front of artificial eye lens
        this.startMotorAnimation('inspect', 700, 0.65, 60, this.handApertureM, -0.8);
        if (this.isGripping && this.heldObjectId) {
          const held = this.physicalObjects.get(this.heldObjectId);
          resultMsg = `Brought ${held ? held.name : 'held payload'} into focal center of artificial eye (0.35m). Photoreceptors receiving high-density spectral radiance.`;
        } else {
          resultMsg = `Raised empty hand in front of eye optic. Palm surface occupies central visual field.`;
        }
        break;
      }

      case 'interact': {
        // Full backward compatibility for interact
        const targetParam = args.objectId || args.target || args.region_id;
        const { obj, reason } = this.resolveTargetObject(targetParam);

        if (obj) {
          const dist = this.agentGroup.position.distanceTo(obj.mesh.position);
          if (dist <= 2.2) {
            this.startMotorAnimation('poke', 450, 0.9, 35, 0.12);
            resultMsg = `Proximity interaction with ${obj.name}: Surface contacted at ${dist.toFixed(2)}m. Tactile normal force: ${this.currentTactileState.totalNormalForceN}N, deformation: ${this.currentTactileState.maxDeformationMm}mm.`;
          } else {
            resultMsg = `Interaction failed: ${obj.name} is too far (${dist.toFixed(2)}m). Move closer to interact.`;
          }
        } else {
          resultMsg = `Interaction performed in space: ${reason}`;
        }
        break;
      }

      case 'stay':
      case 'wait': {
        const dur = typeof args.duration === 'number' ? args.duration : 1;
        resultMsg = `Stationary observation maintained (${dur}s duration).`;
        break;
      }

      default:
        resultMsg = `Unknown action '${name}'.`;
    }

    this.currentActionDesc = `${name}: ${resultMsg}`;
    if (this.onActionComplete) {
      this.onActionComplete(action, resultMsg);
    }
    return resultMsg;
  }

  /**
   * Fractures a destructible object into genuine persistent 3D physical fragments
   * Objects fracture physically, pieces remain in the chamber, and can be inspected/manipulated.
   */
  public shatterObject(targetObj: WorldObjectPhysicalData, forceN: number): string {
    const parentId = targetObj.id;
    const parentName = targetObj.name;
    const parentPos = [...targetObj.position] as [number, number, number];
    const parentProfile = targetObj.profile;
    const parentMatColor = (targetObj.mesh.material as THREE.MeshStandardMaterial).color;

    // Remove the original mesh from Three.js scene
    this.scene.remove(targetObj.mesh);
    this.physicalObjects.delete(parentId);

    // If held, release grip
    if (this.isGripping && this.heldObjectId === parentId) {
      this.isGripping = false;
      this.heldObjectId = null;
    }

    // Spawn 3 distinct physical 3D fragment polyhedra with unique shapes
    const numFragments = 3;
    const fragmentIds: string[] = [];

    const fragmentGeometries = [
      new THREE.BoxGeometry(0.55, 0.45, 0.55),
      new THREE.TetrahedronGeometry(0.48),
      new THREE.DodecahedronGeometry(0.38),
    ];

    for (let i = 0; i < numFragments; i++) {
      const fragId = `${parentId}_fragment_${i + 1}`;
      fragmentIds.push(fragId);

      const fragGeo = fragmentGeometries[i % fragmentGeometries.length];
      const fragMat = new THREE.MeshStandardMaterial({
        color: parentMatColor,
        roughness: Math.min(0.9, targetObj.surfaceRoughness + 0.3), // Fractured surfaces are rougher
        metalness: 0.1,
      });

      const fragMesh = new THREE.Mesh(fragGeo, fragMat);
      // Disperse fragments outward from impact center
      const angle = (i / numFragments) * Math.PI * 2 + (Math.random() - 0.5);
      const scatterDist = 0.35 + Math.random() * 0.25;
      const fx = parentPos[0] + Math.cos(angle) * scatterDist;
      const fz = parentPos[2] + Math.sin(angle) * scatterDist;
      const fy = 0.35; // Land on floor

      fragMesh.position.set(fx, fy, fz);
      fragMesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      fragMesh.castShadow = true;
      fragMesh.receiveShadow = true;
      (fragMesh as any).spectralProfile = parentProfile;
      (fragMesh as any).surfaceId = fragId;

      this.scene.add(fragMesh);

      // Register fragment as an independent, persistent physical object
      this.physicalObjects.set(fragId, {
        id: fragId,
        name: `Fragment #${i + 1} of ${parentName}`,
        shape: 'octahedron',
        position: [fx, fy, fz],
        size: [0.5, 0.5, 0.5],
        mesh: fragMesh,
        profile: parentProfile,
        info: {
          id: fragId,
          name: `Fragment #${i + 1} of ${parentName}`,
          shape: 'octahedron',
          position: [fx, fy, fz],
          size: [0.5, 0.5, 0.5],
          materialName: `${parentProfile.name} (Fractured Shard)`,
          spectralProfileName: parentProfile.id,
        },
        massKg: targetObj.massKg / numFragments,
        compliance: 0.05, // Broken shards become more rigid
        surfaceRoughness: 0.85,
        frictionCoeff: 0.75,
        isMovable: true,
        isDestructible: true, // Shards themselves can break further if excessive force is applied!
        fractureThresholdN: 32.0,
        isFragment: true,
        parentObjectId: parentId,
        isHeld: false,
        velocity: new THREE.Vector3(0, 0, 0),
      });
    }

    // Refresh cached meshes for raycasting
    this.updateCachedTargetMeshes();

    this.emitAcousticSound({
      sourcePosition: parentPos,
      fundamentalHz: 1250,
      bandwidthHz: 900,
      soundPressureDbSpl: 84,
      durationSeconds: 0.45,
      harmonicity: 0.2, // inharmonic broad shock burst
      transientAttack: true,
      category: 'fracture',
    });

    return `Applied ${forceN.toFixed(1)}N compressive force to ${parentName}. Force exceeded critical yield threshold (${targetObj.fractureThresholdN}N); object experienced CATASTROPHIC FRACTURE into ${numFragments} persistent physical fragments (${fragmentIds.join(', ')}). High-frequency mechanical shock spike registered on Pacinian tactile receptors and acoustic cochlear transients. Broken fragments remain permanently in chamber.`;
  }

  /**
   * Helper to trigger smooth motor animations
   */
  private startMotorAnimation(
    name: string,
    durationMs: number,
    targetArmExt: number,
    targetFlexion: number,
    targetAperture: number,
    pitchAdjust: number = 0
  ) {
    const startTime = performance.now();
    this.activeAnimation = {
      name,
      startTime,
      duration: durationMs / 1000,
      startArmExt: this.armExtension,
      targetArmExt,
      startWristPos: new THREE.Vector3(),
      targetWristPos: new THREE.Vector3(),
      startFlexion: this.fingerFlexionDeg,
      targetFlexion,
      startAperture: this.handApertureM,
      targetAperture,
      startPitch: this.agentWristGroup.rotation.x,
      targetPitch: pitchAdjust,
      onUpdate: (progress: number) => {
        // Ease out cubic
        const ease = 1 - Math.pow(1 - progress, 3);
        const currentExt = this.armExtension + (targetArmExt - this.armExtension) * ease;
        const currentFlex = this.fingerFlexionDeg + (targetFlexion - this.fingerFlexionDeg) * ease;
        const currentAp = this.handApertureM + (targetAperture - this.handApertureM) * ease;
        this.setArmPosture(currentExt, currentFlex, currentAp);
      },
      onFinish: () => {
        this.setArmPosture(targetArmExt, targetFlexion, targetAperture);
        this.activeAnimation = null;
      },
    };
  }

  /**
   * Applies translation with boundary clamping and obstacle collision buffer
   */
  private applyTranslation(dx: number, dz: number, desc: string): string {
    const newX = this.agentPose.x + dx;
    const newZ = this.agentPose.z + dz;

    const boundary = 4.2;
    if (Math.abs(newX) > boundary || Math.abs(newZ) > boundary) {
      return `${desc} blocked by enclosure boundary wall. Position maintained at (${this.agentPose.x.toFixed(2)}, ${this.agentPose.z.toFixed(2)}).`;
    }

    // Check collision with physical objects
    for (const obj of this.physicalObjects.values()) {
      if (obj.isHeld) continue;
      const [ox, , oz] = obj.position;
      const distToObj = Math.hypot(newX - ox, newZ - oz);
      const safeRadius = Math.max(0.6, (obj.size[0] + obj.size[2]) * 0.35 + 0.3);
      if (distToObj < safeRadius) {
        return `${desc} impeded by solid obstacle (${obj.name}) at (${ox.toFixed(1)}, ${oz.toFixed(1)}).`;
      }
    }

    this.agentPose.x = newX;
    this.agentPose.z = newZ;
    this.agentGroup.position.x = newX;
    this.agentGroup.position.z = newZ;

    return `${desc} successful. Position: (${newX.toFixed(2)}, ${newZ.toFixed(2)}).`;
  }

  /**
   * Sets active illumination spectrum preset
   */
  public setLightPreset(presetId: string) {
    const found = LIGHT_PRESETS.find((p) => p.id === presetId);
    if (found) {
      this.activeLightPreset = found;
      this.mainLight.color.set(found.colorHex);
      this.ceilingLightMesh.material = new THREE.MeshBasicMaterial({ color: found.colorHex });
    }
  }

  /**
   * Reset Agent to center origin
   */
  public resetWorld() {
    this.agentPose = {
      x: 0,
      y: 1.1,
      z: 0.5,
      yaw: 0,
      pitch: 0,
      fov: 75,
    };
    this.agentGroup.position.set(0, 0, 0.5);
    this.agentGroup.rotation.y = 0;
    this.agentHead.rotation.x = 0;
    this.setArmPosture(0.0, 10, 0.14);
    this.isGripping = false;
    this.heldObjectId = null;
    this.currentActionDesc = 'Reset to origin';
  }

  public setPaused(paused: boolean) {
    this.isPaused = paused;
  }

  public getPaused(): boolean {
    return this.isPaused;
  }

  /**
   * Third-Person Camera mouse orbit drag controls
   */
  private initMouseControls() {
    const dom = this.renderer.domElement;

    const onMouseDown = (e: MouseEvent) => {
      if (this.viewMode !== 'third_person') return;
      this.isDragging = true;
      this.prevMouseX = e.clientX;
      this.prevMouseY = e.clientY;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!this.isDragging || this.viewMode !== 'third_person') return;
      const deltaX = e.clientX - this.prevMouseX;
      const deltaY = e.clientY - this.prevMouseY;
      this.prevMouseX = e.clientX;
      this.prevMouseY = e.clientY;

      this.humanCamTheta -= deltaX * 0.007;
      this.humanCamPhi = Math.max(0.1, Math.min(Math.PI / 2.1, this.humanCamPhi + deltaY * 0.007));
      this.updateHumanCameraPosition();
    };

    const onMouseUp = () => {
      this.isDragging = false;
    };

    const onWheel = (e: WheelEvent) => {
      if (this.viewMode !== 'third_person') return;
      e.preventDefault();
      this.humanCamDistance = Math.max(3, Math.min(20, this.humanCamDistance + e.deltaY * 0.01));
      this.updateHumanCameraPosition();
    };

    dom.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    dom.addEventListener('wheel', onWheel, { passive: false });
  }

  private updateHumanCameraPosition() {
    const x = this.humanCamDistance * Math.sin(this.humanCamPhi) * Math.sin(this.humanCamTheta);
    const y = this.humanCamDistance * Math.cos(this.humanCamPhi);
    const z = this.humanCamDistance * Math.sin(this.humanCamPhi) * Math.cos(this.humanCamTheta);

    this.humanCamera.position.set(
      this.humanCamTarget.x + x,
      this.humanCamTarget.y + y,
      this.humanCamTarget.z + z
    );
    this.humanCamera.lookAt(this.humanCamTarget);
  }

  /**
   * Main animation and continuous artificial multisensory perception loop
   */
  private animate() {
    this.animationFrameId = requestAnimationFrame(this.animate);

    const now = performance.now();
    const dt = Math.min(0.1, (now - this.lastFrameTime) / 1000);
    this.lastFrameTime = now;

    if (!this.isPaused) {
      // Gentle optic pulse on the artificial eye lens
      const pulse = 0.8 + 0.2 * Math.sin(now * 0.005);
      (this.agentEyeLens.material as THREE.MeshBasicMaterial).color.setRGB(0, 0.9 * pulse, 1.0 * pulse);

      // Advance active motor animations
      if (this.activeAnimation) {
        const elapsed = (now - this.activeAnimation.startTime) / 1000;
        const progress = Math.min(1.0, elapsed / (this.activeAnimation.duration || 0.001));
        if (this.activeAnimation.onUpdate) {
          this.activeAnimation.onUpdate(progress);
        }
        if (progress >= 1.0) {
          if (this.activeAnimation.onFinish) this.activeAnimation.onFinish();
          this.activeAnimation = null;
        }
      }

      // Continuous Local Physics & Virtual Skin / Proprioception update
      this.updateMultisensoryPhysics(dt);

      // Continuous Artificial Auditory Processing update
      const isMoving = this.activeAnimation !== null || this.bodyTurnTarget !== null || this.bodyMoveTarget !== null;
      const headVel: [number, number, number] = isMoving ? [0.15, 0, 0.15] : [0, 0, 0];
      this.currentAuditoryState = this.auditoryProcessor.process(
        this.agentPose,
        headVel,
        now / 1000,
        this.sensoryToggles.hearing
      );

      // Continuously sample artificial eye at ~20 Hz (every 48ms) to maintain smooth 60 FPS 3D rendering
      if (now - this.lastRetinaSampleTime >= 48 || !this.lastVisionState) {
        this.lastRetinaSampleTime = now;
        this.lastVisionState = this.sampleArtificialEye();
      }

      if (this.onStateUpdate && this.lastVisionState) {
        this.onStateUpdate(
          this.lastVisionState,
          { ...this.agentPose },
          this.currentTactileState,
          this.currentProprioState,
          this.currentAuditoryState
        );
      }
    }

    // Render 3D viewport
    if (this.viewMode === 'agent_pov') {
      this.agentFrustumCone.visible = false;
      this.renderer.render(this.scene, this.eyeCamera);
      this.agentFrustumCone.visible = true;
    } else {
      this.renderer.render(this.scene, this.humanCamera);
    }
  }

  public emitAcousticSound(event: Partial<AcousticEvent> & {
    sourcePosition?: [number, number, number];
    soundPressureDbSpl?: number;
    durationSeconds?: number;
    fundamentalHz?: number;
    category?: string;
    transientAttack?: boolean;
    harmonicity?: number;
  }) {
    if (!this.sensoryToggles.hearing) return;

    const fullEvent: AcousticEvent = {
      id: event.id || `snd_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      sourceId: event.sourceId || 'env',
      type: (event.type as any) || (event.category === 'movement' ? 'locomotion' : 'friction'),
      worldPosition: event.worldPosition || event.sourcePosition || [this.agentPose.x, 0.5, this.agentPose.z],
      sourceVelocity: event.sourceVelocity || [0, 0, 0],
      baseFrequencyHz: event.baseFrequencyHz || event.fundamentalHz || 250,
      bandwidthHz: event.bandwidthHz || 100,
      peakPressurePa:
        event.peakPressurePa ||
        (event.soundPressureDbSpl ? 0.00002 * Math.pow(10, event.soundPressureDbSpl / 20) : 0.02),
      durationMs: event.durationMs || (event.durationSeconds ? event.durationSeconds * 1000 : 300),
      startTime: event.startTime || (performance.now() / 1000),
      decayType: event.decayType || (event.transientAttack ? 'burst' : 'exponential'),
      roughnessIndex: event.roughnessIndex || 0.3,
    };

    this.auditoryProcessor.emitSound(fullEvent);
  }

  public setSensoryToggles(toggles: Partial<SensoryToggles>) {
    this.sensoryToggles = {
      ...this.sensoryToggles,
      ...toggles,
    };
  }

  public getSensoryToggles(): SensoryToggles {
    return { ...this.sensoryToggles };
  }

  // ==========================================
  // SANDBOX SIMULATION MANIPULATION & PERTURBATION
  // ==========================================
  private sandboxPerturbations: string[] = [];
  private selectedSandboxObjectId: string | null = null;
  private selectionRingMesh: THREE.Mesh | null = null;

  public getSandboxPerturbations(): string[] {
    return [...this.sandboxPerturbations];
  }

  public clearSandboxPerturbations(): void {
    this.sandboxPerturbations = [];
  }

  public getSandboxObjects(): Array<{
    id: string;
    name: string;
    shape: string;
    position: [number, number, number];
    rotation: [number, number, number];
    size: [number, number, number];
    colorHex: string;
    spectralProfileName: string;
    materialName: string;
    massKg: number;
    compliance: number;
    surfaceRoughness: number;
    isDestructible: boolean;
  }> {
    return Array.from(this.physicalObjects.values()).map((obj) => {
      let colorHex = '#ffffff';
      if ((obj.mesh.material as any)?.color) {
        colorHex = '#' + (obj.mesh.material as any).color.getHexString();
      }
      return {
        id: obj.id,
        name: obj.name,
        shape: obj.shape,
        position: [obj.mesh.position.x, obj.mesh.position.y, obj.mesh.position.z],
        rotation: [
          THREE.MathUtils.radToDeg(obj.mesh.rotation.x),
          THREE.MathUtils.radToDeg(obj.mesh.rotation.y),
          THREE.MathUtils.radToDeg(obj.mesh.rotation.z),
        ],
        size: obj.size,
        colorHex,
        spectralProfileName: obj.info.spectralProfileName,
        materialName: obj.info.materialName,
        massKg: obj.massKg,
        compliance: obj.compliance,
        surfaceRoughness: obj.surfaceRoughness,
        isDestructible: obj.isDestructible,
      };
    });
  }

  public selectSandboxObject(id: string | null): void {
    this.selectedSandboxObjectId = id;
    if (!this.selectionRingMesh) {
      const ringGeo = new THREE.RingGeometry(0.65, 0.8, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85,
      });
      this.selectionRingMesh = new THREE.Mesh(ringGeo, ringMat);
      this.selectionRingMesh.rotation.x = -Math.PI / 2;
      this.selectionRingMesh.position.y = 0.02;
      this.scene.add(this.selectionRingMesh);
    }

    if (id && this.physicalObjects.has(id)) {
      const obj = this.physicalObjects.get(id)!;
      this.selectionRingMesh.visible = true;
      this.selectionRingMesh.position.x = obj.mesh.position.x;
      this.selectionRingMesh.position.z = obj.mesh.position.z;
      const maxDim = Math.max(obj.size[0], obj.size[1], obj.size[2]);
      this.selectionRingMesh.scale.set(maxDim, maxDim, maxDim);
    } else {
      if (this.selectionRingMesh) {
        this.selectionRingMesh.visible = false;
      }
    }
  }

  private rebuildTargetMeshesCache(): void {
    this.cachedTargetMeshes = Array.from(this.physicalObjects.values()).map((o) => o.mesh);
  }

  public moveSandboxObject(id: string, newPos: [number, number, number]): boolean {
    const obj = this.physicalObjects.get(id);
    if (!obj) return false;
    const prevPos = [obj.mesh.position.x, obj.mesh.position.y, obj.mesh.position.z];
    obj.mesh.position.set(newPos[0], newPos[1], newPos[2]);
    obj.position = [...newPos];
    obj.info.position = [...newPos];
    if (this.selectionRingMesh && this.selectedSandboxObjectId === id) {
      this.selectionRingMesh.position.x = newPos[0];
      this.selectionRingMesh.position.z = newPos[2];
    }
    this.emitAcousticSound({
      type: 'sliding' as any,
      worldPosition: newPos,
      soundPressureDbSpl: 52,
      baseFrequencyHz: 280,
      durationMs: 250,
    });
    this.sandboxPerturbations.push(
      `Sandbox perturbation: ${obj.name} shifted from [${prevPos.map((n) => n.toFixed(1)).join(',')}] to [${newPos.map((n) => n.toFixed(1)).join(',')}].`
    );
    this.rebuildTargetMeshesCache();
    return true;
  }

  public rotateSandboxObject(id: string, newRotDeg: [number, number, number]): boolean {
    const obj = this.physicalObjects.get(id);
    if (!obj) return false;
    obj.mesh.rotation.set(
      THREE.MathUtils.degToRad(newRotDeg[0]),
      THREE.MathUtils.degToRad(newRotDeg[1]),
      THREE.MathUtils.degToRad(newRotDeg[2])
    );
    this.emitAcousticSound({
      type: 'sliding' as any,
      worldPosition: [obj.mesh.position.x, obj.mesh.position.y, obj.mesh.position.z],
      soundPressureDbSpl: 44,
      baseFrequencyHz: 340,
      durationMs: 150,
    });
    this.sandboxPerturbations.push(
      `Sandbox perturbation: ${obj.name} rotated to [${newRotDeg.map((n) => Math.round(n)).join('°, ')}°].`
    );
    return true;
  }

  public rotateSandboxObjectDelta(id: string, axis: 'x' | 'y' | 'z', deltaDeg: number): boolean {
    const obj = this.physicalObjects.get(id);
    if (!obj) return false;
    const rad = THREE.MathUtils.degToRad(deltaDeg);
    if (axis === 'x') obj.mesh.rotation.x += rad;
    if (axis === 'y') obj.mesh.rotation.y += rad;
    if (axis === 'z') obj.mesh.rotation.z += rad;

    this.emitAcousticSound({
      type: 'sliding' as any,
      worldPosition: [obj.mesh.position.x, obj.mesh.position.y, obj.mesh.position.z],
      soundPressureDbSpl: 45,
      baseFrequencyHz: 380,
      durationMs: 150,
    });
    this.sandboxPerturbations.push(
      `Sandbox perturbation: ${obj.name} rotated ${deltaDeg > 0 ? '+' : ''}${deltaDeg}° on ${axis.toUpperCase()}-axis.`
    );
    return true;
  }

  public resetSandboxObjectRotation(id: string): boolean {
    const obj = this.physicalObjects.get(id);
    if (!obj) return false;
    obj.mesh.rotation.set(0, 0, 0);
    this.sandboxPerturbations.push(`Sandbox perturbation: ${obj.name} rotation reset to [0°, 0°, 0°].`);
    return true;
  }

  public changeSandboxObjectColor(id: string, colorHex: number, profileName: string, materialLabel?: string): boolean {
    const obj = this.physicalObjects.get(id);
    if (!obj) return false;
    const profile = (MATERIAL_PROFILES as any)[profileName] || MATERIAL_PROFILES.red_sample;
    obj.profile = profile;
    obj.info.spectralProfileName = profileName;
    if (materialLabel) obj.info.materialName = materialLabel;
    if ((obj.mesh.material as any)?.color) {
      (obj.mesh.material as any).color.setHex(colorHex);
    }
    (obj.mesh as any).spectralProfile = profile;
    this.emitAcousticSound({
      type: 'impact' as any,
      worldPosition: [obj.mesh.position.x, obj.mesh.position.y, obj.mesh.position.z],
      soundPressureDbSpl: 45,
      baseFrequencyHz: 650,
      durationMs: 150,
    });
    this.sandboxPerturbations.push(
      `Sandbox perturbation: ${obj.name} spectral reflectance transformed to ${profileName} (#${colorHex.toString(16)}).`
    );
    return true;
  }

  public changeSandboxObjectShape(id: string, newShape: 'box' | 'sphere' | 'cylinder' | 'cone' | 'torus' | 'prism'): boolean {
    const obj = this.physicalObjects.get(id);
    if (!obj) return false;
    let newGeo: THREE.BufferGeometry;
    const s = obj.size;
    switch (newShape) {
      case 'sphere':
        newGeo = new THREE.SphereGeometry(s[0] / 2, 32, 24);
        break;
      case 'cylinder':
        newGeo = new THREE.CylinderGeometry(s[0] / 2, s[0] / 2, s[1], 32);
        break;
      case 'cone':
        newGeo = new THREE.ConeGeometry(s[0] / 2, s[1], 32);
        break;
      case 'torus':
        newGeo = new THREE.TorusGeometry(s[0] * 0.45, s[0] * 0.18, 18, 36);
        break;
      case 'prism':
        newGeo = new THREE.CylinderGeometry(s[0] / 2, s[0] / 2, s[1], 3);
        break;
      case 'box':
      default:
        newGeo = new THREE.BoxGeometry(s[0], s[1], s[2]);
        break;
    }
    obj.mesh.geometry.dispose();
    obj.mesh.geometry = newGeo;
    obj.shape = newShape as any;
    obj.info.shape = newShape as any;
    this.emitAcousticSound({
      type: 'fracture' as any,
      worldPosition: [obj.mesh.position.x, obj.mesh.position.y, obj.mesh.position.z],
      soundPressureDbSpl: 55,
      baseFrequencyHz: 420,
      durationMs: 200,
    });
    this.sandboxPerturbations.push(
      `Sandbox perturbation: ${obj.name} morphed morphology to ${newShape.toUpperCase()}.`
    );
    this.rebuildTargetMeshesCache();
    return true;
  }

  public spawnSandboxObject(
    name: string,
    shape: 'box' | 'sphere' | 'cylinder' | 'cone' | 'torus',
    colorHex: number,
    spectralProfileName: string,
    position: [number, number, number]
  ): string {
    const id = 'sandbox_obj_' + Date.now().toString(36);
    let geo: THREE.BufferGeometry;
    switch (shape) {
      case 'sphere': geo = new THREE.SphereGeometry(0.5, 32, 24); break;
      case 'cylinder': geo = new THREE.CylinderGeometry(0.4, 0.4, 0.8, 32); break;
      case 'cone': geo = new THREE.ConeGeometry(0.45, 0.9, 32); break;
      case 'torus': geo = new THREE.TorusGeometry(0.4, 0.16, 16, 32); break;
      default: geo = new THREE.BoxGeometry(0.8, 0.8, 0.8); break;
    }
    const mat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.3, metalness: 0.1 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(position[0], position[1], position[2]);
    mesh.visible = !this.isDigitalVoid;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const profile = (MATERIAL_PROFILES as any)[spectralProfileName] || MATERIAL_PROFILES.red_sample;
    (mesh as any).spectralProfile = profile;
    (mesh as any).surfaceId = id;
    this.scene.add(mesh);
    this.physicalObjects.set(id, {
      id,
      name,
      shape,
      position,
      size: [0.8, 0.8, 0.8],
      mesh,
      profile,
      info: {
        id,
        name,
        shape: shape as any,
        position,
        size: [0.8, 0.8, 0.8],
        materialName: 'Custom Sandbox Entity',
        spectralProfileName,
      },
      massKg: 1.0,
      compliance: 0.3,
      surfaceRoughness: 0.2,
      frictionCoeff: 0.5,
      isMovable: true,
      isDestructible: true,
      fractureThresholdN: 40.0,
      isFragment: false,
      isHeld: false,
      velocity: new THREE.Vector3(0, 0, 0),
    });
    this.emitAcousticSound({
      type: 'impact' as any,
      worldPosition: position,
      soundPressureDbSpl: 60,
      baseFrequencyHz: 500,
      durationMs: 300,
    });
    this.sandboxPerturbations.push(
      `Sandbox perturbation: New entity "${name}" materialized at [${position.map((n) => n.toFixed(1)).join(',')}].`
    );
    this.rebuildTargetMeshesCache();
    return id;
  }

  public deleteSandboxObject(id: string): boolean {
    const obj = this.physicalObjects.get(id);
    if (!obj) return false;
    this.scene.remove(obj.mesh);
    obj.mesh.geometry.dispose();
    if (Array.isArray(obj.mesh.material)) {
      obj.mesh.material.forEach((m) => m.dispose());
    } else {
      obj.mesh.material.dispose();
    }
    this.physicalObjects.delete(id);
    if (this.selectedSandboxObjectId === id) {
      this.selectSandboxObject(null);
    }
    this.sandboxPerturbations.push(`Sandbox perturbation: Entity "${obj.name}" was removed from the chamber.`);
    this.rebuildTargetMeshesCache();
    return true;
  }

  public randomizeSandboxConfusion(): void {
    const keys = Array.from(this.physicalObjects.keys());
    if (keys.length === 0) return;
    const randomKey = keys[Math.floor(Math.random() * keys.length)];
    const obj = this.physicalObjects.get(randomKey)!;

    const shapes: Array<'box' | 'sphere' | 'cylinder' | 'cone' | 'torus' | 'prism'> = [
      'box', 'sphere', 'cylinder', 'cone', 'torus', 'prism'
    ];
    const newShape = shapes[Math.floor(Math.random() * shapes.length)];
    const colors = [
      { hex: 0xe53935, profile: 'red_sample', name: 'Crimson L-wave' },
      { hex: 0x43a047, profile: 'green_sample', name: 'Emerald M-wave' },
      { hex: 0x1e88e5, profile: 'blue_sample', name: 'Sapphire S-wave' },
      { hex: 0xfbc02d, profile: 'yellow_sample', name: 'Solar M+L' },
      { hex: 0x8e24aa, profile: 'torus_magenta', name: 'UV Violet' },
      { hex: 0x00acc1, profile: 'prism_cyan', name: 'Cyan Fluorescent' },
      { hex: 0xff6f00, profile: 'hex_amber', name: 'Infrared Thermal' },
      { hex: 0xf5f5f5, profile: 'white_sample', name: 'Alabaster Ceramic' },
    ];
    const newColor = colors[Math.floor(Math.random() * colors.length)];
    const newX = (Math.random() - 0.5) * 5.5;
    const newZ = (Math.random() - 0.5) * 5.5;

    this.changeSandboxObjectShape(randomKey, newShape);
    this.changeSandboxObjectColor(randomKey, newColor.hex, newColor.profile);
    this.moveSandboxObject(randomKey, [newX, obj.mesh.position.y, newZ]);
    this.sandboxPerturbations.push(
      `Surprise Confusion: ${obj.name} shape morphed to ${newShape}, color shifted to ${newColor.name}, and jumped to [${newX.toFixed(1)}, ${newZ.toFixed(1)}]!`
    );
  }

  public handleResize() {
    const width = this.container.clientWidth || 800;
    const height = this.container.clientHeight || 500;
    this.humanCamera.aspect = width / height;
    this.humanCamera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  public getTestObjects(): WorldObjectInfo[] {
    return Array.from(this.physicalObjects.values()).map((v) => v.info);
  }

  public dispose() {
    cancelAnimationFrame(this.animationFrameId);
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}
