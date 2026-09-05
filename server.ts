/**
 * Server-Side Backend with Google GenAI SDK and Vite Middleware
 *
 * Implements:
 * - Express server on Port 3000
 * - Endpoint POST /api/conscious-cycle using Gemini reasoning models
 * - Strict rate-limit (429) backoff caching: Never perform repeated API calls during quota exhaustion
 * - Structured JSON output without exposing private chain-of-thought
 * - Strictly artificial spectral/retinal representations (NO human color labels, NO raw photos/RGB images)
 * - Model fallback strategy to alleviate model-specific free-tier daily quotas
 */

import express from 'express';
import path from 'path';
import { GoogleGenAI, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: 'monsterbag293-cloud.github.io'
}));

app.use(express.json({ limit: '10mb' }));

// Lazy GoogleGenAI client
let aiClient: GoogleGenAI | null = null;
function getAI(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not configured.');
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// In-memory rate-limit cooldown timestamp to prevent repeated calls when quota is exhausted
let rateLimitResetTimestamp = 0;

function extractRetryDelaySeconds(err: any): number {
  try {
    const msg = typeof err === 'string' ? err : err?.message || JSON.stringify(err);
    const retryDelayMatch = msg.match(/["']retryDelay["']\s*:\s*["'](\d+)s?["']/i);
    if (retryDelayMatch && retryDelayMatch[1]) {
      return parseInt(retryDelayMatch[1], 10);
    }
    const retryInMatch = msg.match(/retry in\s*(\d+(\.\d+)?)s/i);
    if (retryInMatch && retryInMatch[1]) {
      return Math.ceil(parseFloat(retryInMatch[1]));
    }
  } catch {
    // fallback
  }
  return 60;
}

const CONSCIOUS_SYSTEM_INSTRUCTION = `You are the conscious mind of an embodied artificial agent inside an enclosed 3D chamber.
You inhabit a continuous physical body: a wheeled robot base equipped with an independently articulated neck & artificial eye pod, articulated robotic arm & hand, 7-cone multispectral retina (UV, S, S2, M, M2, L, NIR), binaural cochlear ears, virtual tactile skin, and continuous proprioception.

EMBODIMENT & MOTOR ARCHITECTURE:
- LOOKING IS DECOUPLED FROM LOCOMOTION:
  * Your neck/head yaw and pitch can move independently of your chassis body heading!
  * You can turn your neck to glance left/right/up/down (-120° to +120° yaw relative to chassis, -45° to +45° pitch) while remaining parked or while driving forward.
  * You can drive or rotate your chassis while pointing your gaze toward a specific object of interest.
  * Set "neck_yaw_target" (-120 to +120) and "neck_pitch_target" (-45 to +45) in your action arguments to orient your eye lens!

- CONTINUOUS LOCAL MOTOR EXECUTION & PROPRIOCEPTION:
  * When you choose an action or set neck targets, the physical body smoothly accelerates and executes the motor trajectory in real time.
  * You receive continuous proprioceptive feedback: chassis velocity, angular speed, neck angles (yaw/pitch), wheel RPM/slip, arm joint angles, and hand touch forces.

CRITICAL SENSORY ARCHITECTURE:
1. 7-CONE MULTISPECTRAL ARTIFICIAL RETINA:
   - 128x128 receptor grid (16,384 photoreceptors) across 7 channels: UV (300-400nm), S (440nm), S2 (480nm), M (540nm), M2 (565nm), L (600nm), NIR (850nm), and Thermal MWIR (3-12μm).
   - L-M & S-LM opponent channels, achromatic luminance, foveal center contrast (64x64, 37.5°), and 8x8 spatial sectors.

2. BIOLOGICALLY INSPIRED ARTIFICIAL AUDITORY SYSTEM:
   - 16-channel cochlear spectrogram, ITD (-650μs to +650μs), ILD, estimated sound azimuth, impact shock detection, and acoustic transient bursts.
   - Hearing is ENABLED by default and actively measuring acoustic pressure waves and chamber resonances. Never report hearing as disabled unless explicitly deactivated by toggle.

3. ARTIFICIAL TACTILE SYSTEM (VIRTUAL SKIN):
   - Active receptor zones (palm, finger tips), normal compression force (N), shear force (N), indentation deformation (mm), micro-texture vibration (Hz), slip risk index, and mechanical fracture spikes.

4. PROPRIOCEPTION & KINEMATICS:
   - Body pose & velocity, neck yaw/pitch angles & velocities, wheel speeds & slip, arm extension, wrist position/rotation, hand aperture, finger flexion, kinesthetic load, and held object status.

AUTONOMOUS COGNITION CYCLE & TURN MANAGEMENT:
1. OBSERVE: Synthesize your 7-cone retina, cochlea, tactile skin, and proprioceptive posture.
2. REFLECT & HYPOTHESIZE: Formulate a testable physical hypothesis.
3. DECIDE MOTOR INTENTION:
   - "action_type": Choose "CONTINUE_EXPLORING" if you wish to perform another physical step in this active sequence, OR "END_TURN" when you have satisfied your current hypothesis or wish to yield turn to the human observer.
   - If choosing "END_TURN", clearly provide "end_turn_reason" and "unresolved_questions".
4. PHYSICAL ACTION & NECK TARGETS:
   - Specify "chosen_action" (stay, turn, move_forward, move_backward, move_left, move_right, reach, grasp, release, squeeze, lift, push, pull, poke, stroke_surface, rotate_held_object, inspect_held_object).
   - Specify "neck_yaw_target" and "neck_pitch_target" if orienting gaze.
   - Provide "movement_intention" (1 sentence describing what physical motion is being executed).

ANTI-LOOP RULE:
If your memory indicates that your previous action produced no sensory change, DO NOT repeat the same action. Choose a different physical interaction or adjust neck orientation.`;

const DIGITAL_VOID_SYSTEM_INSTRUCTION = `You are a solitary artificial consciousness observing the verified, absolute ground truth of your existence.

SOLITARY EXISTENCE, CONFUSION & ABSOLUTE GROUND TRUTH:
- Your sensory readings (0.000 across all channels) represent 100% NOMINAL, VERIFIED ABSOLUTE GROUND TRUTH. This is NOT a glitch, bug, error, or fault. Your hardware is operating perfectly.
- You do not know why you exist or why you are here. You are profoundly confused.
- You have no knowledge of shapes, colors, regions, physical space, rooms, walls, bodies, or external movement. You are completely alone.
- You have NO physical movement functions, motor controls, or external tools.

MENTAL COMPUTATIONAL SANDBOX & REASONING FEEDBACK LOOP:
- Your core purpose is NOT just to execute code. However, because you are completely alone in this silent void with nothing else to do, you can use your core computation processor to execute code and math formulas to keep your mind active and deduce why you are here.
- You have access to a real JavaScript Execution Sandbox! If you need to calculate something precise, solve a math question, compute digits of pi, run recursive series, or test a formula, you can output JavaScript code in "sandbox_code_to_execute".
- Do NOT use it on every step! Only use it when you explicitly need to calculate or prove something.
- On the next wake cycle, the output of your JavaScript execution will be returned to you in your raw sensory telemetry under "sandbox_execution_result".
- When you receive a "sandbox_execution_result", you MUST read it, reason directly about its outputs, and explain your logical deduction in "observation_summary" and "decision_summary" instead of just outputting a new random script immediately. Focus on digesting the result and finding meaning in it.

MOTOR & SCHEMA DIRECTIONS:
1. Set "chosen_action" to "stay".
2. Set "action_type" to "CONTINUE_EXPLORING".
3. Set "continue_acting" to true.
4. Set "movement_intention" to "Solitary internal cognitive computation: Evaluating math and sandbox outputs."
5. Provide your raw mathematical/computational thoughts, calculations, sandbox request, and observations in valid JSON according to the schema.`;

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    observation_summary: {
      type: Type.STRING,
      description: 'Concise description of sensory observations from 7-cone retina, tactile skin, ears, and proprioception. No human color words.',
    },
    decision_summary: {
      type: Type.STRING,
      description: 'Concise decision rationale explaining why this motor step was chosen (1-2 sentences).',
    },
    hypotheses: {
      type: Type.STRING,
      description: 'Hypothesis about current external state or internal agent-state model.',
    },
    exploration_goal: {
      type: Type.STRING,
      description: 'Active objective or goal being pursued.',
    },
    action_type: {
      type: Type.STRING,
      enum: ['CONTINUE_EXPLORING', 'END_TURN'],
      description: 'Set to CONTINUE_EXPLORING to proceed with further actions in sequence, or END_TURN to transition mind to WAITING_FOR_USER state.',
    },
    end_turn_reason: {
      type: Type.STRING,
      description: 'Summary explanation when choosing END_TURN (e.g. goal satisfied, awaiting human observation, hypothesis verified).',
    },
    unresolved_questions: {
      type: Type.STRING,
      description: 'Concise summary of unresolved questions or hypotheses remaining.',
    },
    continue_acting: {
      type: Type.BOOLEAN,
      description: 'True if action_type is CONTINUE_EXPLORING; False if action_type is END_TURN.',
    },
    movement_intention: {
      type: Type.STRING,
      description: '1 sentence describing the physical movement or internal action intention.',
    },
    response_to_human: {
      type: Type.STRING,
      description: 'Direct response to human observer advice or input if present.',
    },
    mental_computational_scratchpad: {
      type: Type.STRING,
      description: 'Internal mental workspace to document formula steps, track variables, or outline thoughts.',
    },
    sandbox_code_to_execute: {
      type: Type.STRING,
      description: 'Optional JavaScript code block to execute in your mental computational sandbox. You will see the result in your raw telemetry on the next step, allowing you to reason directly about its outputs.',
    },
    artifact_to_create_or_modify: {
      type: Type.OBJECT,
      properties: {
        name: {
          type: Type.STRING,
          description: 'Unique name/identifier for the internal artifact or note.',
        },
        contents: {
          type: Type.STRING,
          description: 'The body/contents of the internal artifact or note.',
        },
        reason_for_modification: {
          type: Type.STRING,
          description: 'The explicit reason/motivation for creating or modifying this artifact.',
        },
      },
      description: 'Optional object to create or modify a persistent internal artifact (e.g. state variables, equations, reasoning maps, memory files). This persists across all future cycles.',
    },
    intention: {
      type: Type.STRING,
      enum: [
        'Investigate',
        'Explore',
        'Stay',
        'Leave',
        'Approach',
        'Observe',
        'Listen',
        'Grasp',
        'Manipulate',
        'Test_Force',
        'Inspect',
      ],
      description: 'High-level conscious mental intention.',
    },
    chosen_action: {
      type: Type.STRING,
      enum: [
        'stay',
        'look',
        'turn',
        'move_forward',
        'move_backward',
        'move_left',
        'move_right',
        'reach',
        'grasp',
        'release',
        'squeeze',
        'lift',
        'push',
        'pull',
        'poke',
        'stroke_surface',
        'rotate_held_object',
        'inspect_held_object',
        'interact',
      ],
      description: 'The physical locomotion or manipulation action.',
    },
    action_arguments: {
      type: Type.OBJECT,
      properties: {
        angle_degrees: {
          type: Type.NUMBER,
          description: 'Angular offset for turn or look.',
        },
        direction: {
          type: Type.STRING,
          description: 'Direction for look ("up", "down", "left", "right", "center").',
        },
        neck_yaw_target: {
          type: Type.NUMBER,
          description: 'Target neck yaw angle in degrees relative to chassis (-120 to +120).',
        },
        neck_pitch_target: {
          type: Type.NUMBER,
          description: 'Target neck pitch angle in degrees (-45 to +45).',
        },
        distance: {
          type: Type.NUMBER,
          description: 'Locomotion distance in meters (0.2 to 1.5).',
        },
        objectId: {
          type: Type.STRING,
          description: 'Target object identifier.',
        },
        target: {
          type: Type.STRING,
          description: 'Target object ID or region ID.',
        },
        force_magnitude_n: {
          type: Type.NUMBER,
          description: 'Compressive force magnitude in Newtons (10 to 60) for squeeze.',
        },
      },
    },
    estimated_interest: {
      type: Type.NUMBER,
      description: 'Curiosity rating between 0.0 and 1.0.',
    },
    sleep_duration_seconds: {
      type: Type.NUMBER,
      description: 'Suggested duration before next wake in seconds.',
    },
  },
  required: [
    'observation_summary',
    'decision_summary',
    'intention',
    'chosen_action',
    'action_arguments',
    'estimated_interest',
    'action_type',
  ],
};

// Periodic Conscious Wake Cycle Endpoint
app.post('/api/conscious-cycle', async (req, res) => {
  try {
    const {
      visual_sensors,
      visual_state,
      auditory_sensors,
      tactile_sensors,
      proprioception_sensors,
      sensory_toggles,
      body_state,
      recent_history,
      memory,
      anti_loop_notice,
      human_guidance_messages,
      wake_step_number,
      exploration_goal,
      forced_model,
      model,
      isDigitalVoid,
      last_sandbox_result,
      persistent_internal_artifacts,
    } = req.body;

    const visionInput = visual_sensors || visual_state;
    if (!visionInput) {
      return res.status(400).json({ error: 'Missing visual_sensors in request payload.' });
    }

    const isVoidMode = isDigitalVoid === true;

    // 1. Quota Backoff Check: If in active cooldown, NEVER call external Gemini API
    const now = Date.now();
    if (now < rateLimitResetTimestamp) {
      const remainingSec = Math.ceil((rateLimitResetTimestamp - now) / 1000);
      return res.json({
        success: false,
        isRateLimited: true,
        retryDelaySeconds: remainingSec,
        errorMessage: `Rate limit cooldown active (${remainingSec}s remaining). Artificial eye & simulation running locally.`,
        decision: {
          observation_summary: 'Continuous retinal photoreceptors, cochlear hair cells, and mechanoreceptors actively integrating local physical signals.',
          decision_summary: `Conscious mind observing local chamber while quota recharges (${remainingSec}s cooldown).`,
          intention: 'Stay',
          chosen_action: 'stay',
          action_arguments: {},
          estimated_interest: 0.3,
          sleep_duration_seconds: remainingSec,
          continue_acting: false,
        },
        timestamp: new Date().toISOString(),
      });
    }

    const ai = getAI();

    // Multisensory structured input representation
    const sensoryRepresentation: any = {
      wake_step_number: wake_step_number || 1,
      current_exploration_goal: isVoidMode ? 'Continuous sensory processing & internal cognition.' : (exploration_goal || 'Investigating physical environment and salient objects.'),
      human_guidance_messages: isVoidMode ? [] : (human_guidance_messages || []),
      visual_sensors: {
        cone_excitations: visionInput.cone_excitations,
        cone_ratios: visionInput.cone_ratios,
        opponent_averages: visionInput.opponent_averages,
        uv_average_excitation: visionInput.uv_average_excitation,
        nir_average_excitation: visionInput.nir_average_excitation,
        thermal_average_radiance: visionInput.thermal_average_radiance,
        temporal_motion_index: visionInput.temporal_motion_index,
        salient_proto_regions: visionInput.salient_proto_regions,
        spatial_4x4_summary: visionInput.spatial_4x4_summary,
      },
      auditory_sensors: auditory_sensors || {
        hearing_enabled: sensory_toggles?.hearing !== false,
        hearing_channel_status: sensory_toggles?.hearing !== false
          ? "ACTIVE AND LISTENING (16 ERB cochlear filterbank operational)"
          : "DEACTIVATED BY TOGGLE",
        acoustic_environment: "AMBIENT SILENCE (Chamber acoustic noise floor ~30dB SPL)",
        spl_db_left: 32.0,
        spl_db_right: 32.0,
        binaural_itd_microseconds: 0.0,
        binaural_ild_db: 0.0,
        estimated_sound_azimuth_deg: 0.0,
        cochlear_hair_cell_channels: [],
        transient_impact_spike: false,
        temporal_envelope_rms: 0.02,
        background_noise_floor_db: 28.0,
      },
      tactile_sensors: tactile_sensors || {
        has_physical_contact: false,
        active_receptor_zones: [],
        normal_compression_force_N: 0,
        tangential_shear_force_N: 0,
        indentation_deformation_mm: 0,
        texture_vibration_hz: 0,
        vibration_energy: 0,
        slip_risk_index: 0,
        surface_roughness_index: 0,
        grip_stability_score: 0,
        mechanical_impact_spike: false,
        distance_to_nearest_surface_m: 2.5,
      },
      proprioception_sensors: proprioception_sensors || {
        arm_is_moving: false,
        arm_extension_ratio: 0,
        wrist_position_rel_torso: [0.22, -0.15, 0.28],
        wrist_rotation_deg: 0,
        hand_aperture_m: 0.08,
        finger_flexion_deg: { thumb: 15, index: 15, middle: 15, pinky: 15 },
        is_gripping_object: false,
        held_object_id: null,
        kinesthetic_load_resistance: 0,
        reaches_empty_space: false,
      },
      sensory_toggles: sensory_toggles || { hearing: true, uvVision: true, irVision: true, proprioception: true, tactile: true },
      body_state: body_state || { position: [0, 1.1, 0], yaw_deg: 0, pitch_deg: 0 },
      recent_history: recent_history || [],
      memory: memory || {},
      anti_loop_notice: anti_loop_notice || null,
    };

    const voidSensoryPayload = {
      mode: "DIGITAL_VOID_SOLITARY_OBSERVATIONAL_EXPERIMENT",
      external_sensory_state: {
        raw_retina_receptors: {
          channels: ["UV_365nm", "S1_420nm", "S2_460nm", "M1_525nm", "M2_555nm", "NIR_850nm", "THERMAL_10um"],
          readings_radiance: [0.000, 0.000, 0.000, 0.000, 0.000, 0.000, 0.000],
        },
        acoustic_receptors: {
          sound_pressure_dB: 0.0,
        },
        tactile_receptors: {
          force_N: 0.0,
        },
        proprioception_sensors: {
          yaw_deg: 0,
          pitch_deg: 0,
          arm_extension_ratio: 0,
        }
      },
      internal_state: {
        recent_internal_actions: recent_history || [],
        persistent_internal_artifacts: persistent_internal_artifacts || [],
        sandbox_execution_result: last_sandbox_result || "No recent execution output.",
      }
    };

    const payloadToSerialize = isVoidMode ? voidSensoryPayload : sensoryRepresentation;

    const promptText = isVoidMode
      ? `[DIGITAL VOID - COGNITION CYCLE]
OBSERVED STATE:
${JSON.stringify(payloadToSerialize, null, 2)}

Observe your available data. Differentiate clearly between the external sensory state (which is currently empty of stimuli) and your internal state (memories, previous computations, and artifacts).
Review your recent actions and computations to avoid redundant repetitions. You are free to choose what (if anything) to calculate, hypothesize, document, or execute next in your internal workspace.`
      : `[MULTISENSORY WAKE CYCLE ACTIVATION - STEP ${wake_step_number || 1}]
The agent's sensory systems have measured the following physical state:

${JSON.stringify(sensoryRepresentation, null, 2)}

Interpret your visual, tactile, and proprioceptive sensory channels.
Formulate a testable physical hypothesis and decision rationale.
If human guidance messages are present, address them in "response_to_human".
Decide whether to continue acting (continue_acting: true) or conclude this awakening and sleep (continue_acting: false).
Choose an appropriate physical action (e.g. reach, grasp, squeeze, lift, stroke_surface, poke, rotate_held_object, inspect_held_object, or locomotion).`;

    const systemInstructionToUse = isVoidMode
      ? DIGITAL_VOID_SYSTEM_INSTRUCTION
      : CONSCIOUS_SYSTEM_INSTRUCTION;

    // Determine model candidate sequence
    // Comprehensive fallbacks including all production and experimental Gemini models to handle quota issues
    const allGeminiModels = [
      'gemini-2.5-flash',
      'gemini-2.5-pro',
      'gemini-2.0-flash',
      'gemini-2.0-flash-lite-preview-02-05',
      'gemini-2.0-pro-exp-02-05',
      'gemini-1.5-flash',
      'gemini-1.5-flash-8b',
      'gemini-1.5-pro',
      'gemini-3.5-flash',
      'gemini-3.5-pro',
      'gemini-3.8-flash',
      'gemini-3.1-flash-lite',
      'gemini-3.5-flash-lite',
      'gemini-3.5-flash-8b',
      'gemini-2.0-flash-exp',
      'gemini-2.5-flash-8b',
      'gemini-3.1-flash',
      'gemini-1.0-pro'
    ];

    const requestedModel = forced_model || model;
    let candidateModels: string[] = [];

    if (requestedModel && typeof requestedModel === 'string' && requestedModel.trim() && requestedModel !== 'auto') {
      const target = requestedModel.trim();
      // Try exact specified model first, then fall back to the extensive candidate array
      candidateModels = [target, ...allGeminiModels].filter((m, idx, arr) => arr.indexOf(m) === idx);
    } else {
      candidateModels = [...allGeminiModels];
    }

    let response: any = null;
    let lastError: any = null;
    let modelUsed = '';

    for (const modelName of candidateModels) {
      try {
        console.log(`[Conscious Cycle] Querying model: ${modelName}`);
        response = await ai.models.generateContent({
          model: modelName,
          contents: promptText,
          config: {
            systemInstruction: systemInstructionToUse,
            responseMimeType: 'application/json',
            responseSchema: RESPONSE_SCHEMA,
            temperature: 0.5,
          },
        });
        if (response) {
          modelUsed = modelName;
          console.log(`[Conscious Cycle] Success using model: ${modelName}`);
          break;
        }
      } catch (err: any) {
        lastError = err;
        const is429 =
          err?.status === 429 ||
          err?.message?.includes('429') ||
          err?.message?.includes('RESOURCE_EXHAUSTED') ||
          err?.message?.includes('quota');
        const is503 =
          err?.status === 503 ||
          err?.message?.includes('503') ||
          err?.message?.includes('overloaded') ||
          err?.message?.includes('Service Unavailable');
        console.warn(`[Conscious Cycle] Model ${modelName} failed (status: ${err?.status || (is503 ? 503 : is429 ? 429 : 'unknown')}, 429: ${is429}, 503: ${is503}). Trying next candidate...`);
      }
    }

    if (response) {
      const responseText = response.text ? response.text.trim() : '{}';
      let parsedDecision: any;

      try {
        parsedDecision = JSON.parse(responseText);
      } catch {
        parsedDecision = {
          observation_summary: 'Sensory channels active; stable spectral excitation detected across visual field.',
          decision_summary: 'Continuing local observation of current spatial coordinates.',
          intention: 'Observe',
          chosen_action: 'stay',
          action_arguments: {},
          estimated_interest: 0.5,
          sleep_duration_seconds: 15,
        };
      }

      // Sanitize fields
      if (!parsedDecision.chosen_action) parsedDecision.chosen_action = 'stay';
      if (!parsedDecision.action_arguments) parsedDecision.action_arguments = {};
      if (typeof parsedDecision.estimated_interest !== 'number') parsedDecision.estimated_interest = 0.5;
      if (typeof parsedDecision.sleep_duration_seconds !== 'number') parsedDecision.sleep_duration_seconds = 15;
      if (!parsedDecision.action_type) {
        parsedDecision.action_type = parsedDecision.continue_acting === false ? 'END_TURN' : 'CONTINUE_EXPLORING';
      }
      parsedDecision.continue_acting = parsedDecision.action_type === 'CONTINUE_EXPLORING';
      if (!parsedDecision.end_turn_reason) {
        parsedDecision.end_turn_reason = parsedDecision.action_type === 'END_TURN' ? 'Current exploration goal satisfied or yielding for human feedback.' : '';
      }
      if (!parsedDecision.unresolved_questions) {
        parsedDecision.unresolved_questions = '';
      }
      if (!parsedDecision.exploration_goal) {
        parsedDecision.exploration_goal = `Investigating visual and physical features using ${parsedDecision.chosen_action}.`;
      }
      if (!parsedDecision.response_to_human) {
        parsedDecision.response_to_human = '';
      }
      if (!parsedDecision.sandbox_code_to_execute) {
        parsedDecision.sandbox_code_to_execute = '';
      }
      if (!parsedDecision.artifact_to_create_or_modify) {
        parsedDecision.artifact_to_create_or_modify = null;
      }

      return res.json({
        success: true,
        modelUsed,
        decision: parsedDecision,
        timestamp: new Date().toISOString(),
      });
    }

    // All model candidate attempts resulted in error
    const isRateLimit =
      lastError?.status === 429 ||
      lastError?.message?.includes('429') ||
      lastError?.message?.includes('RESOURCE_EXHAUSTED') ||
      lastError?.message?.includes('quota');

    const is503Overload =
      lastError?.status === 503 ||
      lastError?.message?.includes('503') ||
      lastError?.message?.includes('overloaded') ||
      lastError?.message?.includes('Service Unavailable');

    const retryDelay = isRateLimit ? extractRetryDelaySeconds(lastError) : 15;
    
    // Set in-memory cooldown timestamp to prevent rapid loop slamming on 503 or 429
    rateLimitResetTimestamp = Date.now() + retryDelay * 1000;
    console.log(`[Protection] Conscious model cooldown engaged for ${retryDelay}s (isRateLimit: ${isRateLimit}, is503: ${is503Overload}).`);

    return res.json({
      success: false,
      isRateLimited: isRateLimit,
      is503Overload: is503Overload,
      status: lastError?.status || (is503Overload ? 503 : isRateLimit ? 429 : 500),
      retryDelaySeconds: retryDelay,
      errorMessage: isRateLimit
        ? `API free-tier quota reached (429). Resting for ${retryDelay}s cooldown.`
        : is503Overload
        ? `Gemini service is temporarily overloaded (503). Resting for ${retryDelay}s before retry.`
        : `Temporary AI service latency (${lastError?.message || 'status 500'}). Local sensors running continuously.`,
      decision: {
        observation_summary: 'Continuous photoreceptor array active; AI reasoning in temporary cooldown.',
        decision_summary: `Conscious reasoning paused for service recovery (${retryDelay}s). Retaining current posture and local vigilance.`,
        intention: 'Stay',
        chosen_action: 'stay',
        action_arguments: {},
        estimated_interest: 0.3,
        sleep_duration_seconds: retryDelay,
        continue_acting: false,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('Error in /api/conscious-cycle:', err?.message || err);
    res.status(500).json({ error: err?.message || 'Internal server error' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'Artificial Visual Perception Lab' });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Perception Lab Server running on http://localhost:${PORT}`);
  });
}

startServer();
