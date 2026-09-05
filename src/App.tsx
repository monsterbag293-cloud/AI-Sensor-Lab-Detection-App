  /**
 * Artificial Visual Perception Lab - Main Application Component
 *
 * Implements:
 * - Continuous local 3D physical world and biological retinal simulation in Three.js
 * - Multi-action sequence per awakening: AI continues acting until goals are achieved / bored
 * - Live Sandbox Mode: Move, morph shapes, switch spectral reflectance, and surprise confuse the AI
 * - Human Guidance Advisor Chat: Chat with the AI in the thinking panel to provide advice or scene info
 * - Biologically inspired auditory apparatus & extended photoreceptors (UV 300-400nm, NIR, MWIR)
 * - Structured wake -> observe -> reflect -> decide -> act -> continue or sleep cycle
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { SimulatedWorld } from './world/threeWorld';
import { Header } from './components/Header';
import { ControlsToolbar } from './components/ControlsToolbar';
import { ThreeWorldView } from './components/ThreeWorldView';
import { RetinaDebugPanel } from './components/RetinaDebugPanel';
import { TactileProprioPanel } from './components/TactileProprioPanel';
import { AuditoryDebugPanel } from './components/AuditoryDebugPanel';
import { AgentMindPanel } from './components/AgentMindPanel';
import { DigitalVoidPanel } from './components/DigitalVoidPanel';
import { SandboxInspector } from './components/SandboxInspector';
import { LIGHT_PRESETS } from './perception/spectral';
import {
  Layers,
  Hand,
  Eye,
  Volume2,
  PanelRightClose,
  PanelRightOpen,
  Activity,
  X,
  Wrench
} from 'lucide-react';
import {
  AgentPose,
  ArtificialVisionState,
  ArtificialTactileState,
  ProprioceptionState,
  ArtificialAuditoryState,
  SensoryToggles,
  AIMindState,
  CompactAgentMemory,
  MindTimelineEvent,
  CognitiveDecision,
  ToolCallPayload,
  ActionName,
  HumanAdvisorMessage,
  DigitalVoidMetrics,
  DigitalVoidTimelineEvent,
  PersistentArtifact,
  StructuredSandboxResult,
} from './types';
import {
  INITIAL_MEMORY,
  buildCompactSensoryPayload,
  computeSensoryDelta,
  updateAgentMemory,
  formatActionSummary
} from './perception/mindManager';

export default function App() {
  const worldRef = useRef<SimulatedWorld | null>(null);
  const humanDebugCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const prevVisionStateRef = useRef<ArtificialVisionState | null>(null);
  const prevTactileRef = useRef<ArtificialTactileState | null>(null);

  // Continuous Physical Simulation & Sensory States
  const [visionState, setVisionState] = useState<ArtificialVisionState | null>(null);
  const [tactileState, setTactileState] = useState<ArtificialTactileState | null>(null);
  const [proprioState, setProprioState] = useState<ProprioceptionState | null>(null);
  const [auditoryState, setAuditoryState] = useState<ArtificialAuditoryState | null>(null);

  // Clean Default Interface & Drawer States
  const [showTechnicalView, setShowTechnicalView] = useState<boolean>(false);
  const [showSandboxLab, setShowSandboxLab] = useState<boolean>(false);
  const [sensoryViewTab, setSensoryViewTab] = useState<'all' | 'retina' | 'auditory' | 'tactile'>('all');
  const [isMindPanelOpen, setIsMindPanelOpen] = useState<boolean>(true);

  // Sensory Apparatus Toggles
  const [sensoryToggles, setSensoryToggles] = useState<SensoryToggles>({
    vision: true,
    sevenConeVision: true,
    hearing: true,
    uvVision: true,
    irVision: true,
    proprioception: true,
    tactile: true,
  });

  const [pose, setPose] = useState<AgentPose>({
    x: 0,
    y: 1.1,
    z: 0.5,
    yaw: 0,
    pitch: 0,
    fov: 75,
  });

  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [selectedLightId, setSelectedLightId] = useState<string>(LIGHT_PRESETS[0].id);
  const [viewMode, setViewMode] = useState<'third_person' | 'agent_pov'>('third_person');
  const [showRgbDebug, setShowRgbDebug] = useState<boolean>(false);

  // Forced / Selected Gemini Model (gemini-3.1-flash-lite as default)
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    return localStorage.getItem('art_vis_selected_gemini_model') || 'gemini-3.1-flash-lite';
  });

  const handleModelChange = (modelId: string) => {
    setSelectedModel(modelId);
    localStorage.setItem('art_vis_selected_gemini_model', modelId);
    addTimelineEvent('MODEL_CHANGED', `Forced AI Model updated to ${modelId}. Next awakenings will prioritize this model.`);
  };

  // Periodic Conscious Mind States
  const [isAiRunning, setIsAiRunning] = useState<boolean>(false);
  const [isReasoning, setIsReasoning] = useState<boolean>(false);
  const [thinkingInterval, setThinkingInterval] = useState<number>(15); // in seconds
  const [timeUntilNextWake, setTimeUntilNextWake] = useState<number>(15);

  // Human Guidance Advisor Messages
  const [advisorMessages, setAdvisorMessages] = useState<HumanAdvisorMessage[]>([]);
  const advisorMessagesRef = useRef<HumanAdvisorMessage[]>([]);
  advisorMessagesRef.current = advisorMessages;

  // DIGITAL VOID Experimental Mode State
  const [isDigitalVoid, setIsDigitalVoid] = useState<boolean>(false);
  const isDigitalVoidRef = useRef<boolean>(false);
  isDigitalVoidRef.current = isDigitalVoid;

  const lastSandboxResultRef = useRef<string>("");
  const totalCognitionCyclesRef = useRef<number>(0);
  const [persistentArtifacts, setPersistentArtifacts] = useState<PersistentArtifact[]>([]);
  const persistentArtifactsRef = useRef<PersistentArtifact[]>([]);
  persistentArtifactsRef.current = persistentArtifacts;

  const [digitalVoidMetrics, setDigitalVoidMetrics] = useState<DigitalVoidMetrics>({
    startTime: Date.now(),
    totalDurationSeconds: 0,
    cognitionCycles: 0,
    headRotationsCount: 0,
    repeatedSensoryStateCount: 0,
    quotaEventsCount: 0,
    selfGeneratedQuestionsCount: 0,
    selfGeneratedHypothesesCount: 0,
    referencesToUncertaintyCount: 0,
    referencesToLocationCount: 0,
    sensoryStateChangesCount: 0,
    repeatedActionsCount: 0,
  });

  const [digitalVoidTimeline, setDigitalVoidTimeline] = useState<DigitalVoidTimelineEvent[]>([]);

  // DIGITAL VOID Duration Ticker
  useEffect(() => {
    if (!isDigitalVoid) return;
    const interval = setInterval(() => {
      setDigitalVoidMetrics((prev) => ({
        ...prev,
        totalDurationSeconds: Math.floor((Date.now() - prev.startTime) / 1000),
      }));
    }, 1000);
    return () => clearInterval(interval);
  }, [isDigitalVoid]);

  const [mindState, setMindState] = useState<AIMindState>({
    status: 'SLEEPING',
    currentObservation: 'Continuous retinal, cochlear, and tactile sensors active. Baseline integrations underway.',
    thoughtSummary: 'Awaiting conscious wake cycle to evaluate sensory streams and room acoustics.',
    intention: 'Observe',
    currentAction: 'STAY (Observing scene)',
    previousAction: 'None',
    timeSinceLastWake: 0,
    timeUntilNextWake: 15,
    sleepDuration: 15,
    wakeCycleCount: 0,
    estimatedInterest: 0.5,
    consecutiveStationary: 0,
    isRateLimited: false,
    currentStepInCycle: 1,
    maxStepsInCycle: 4,
    advisorMessages: [],
  });

  // Keep mindState.advisorMessages synchronized
  useEffect(() => {
    setMindState((prev) => ({ ...prev, advisorMessages }));
  }, [advisorMessages]);

  // Persistent Compact Memory & Anti-Loop
  const [memory, setMemory] = useState<CompactAgentMemory>(INITIAL_MEMORY);

  // Conscious Wake-Sleep Cycle Timeline
  const [timeline, setTimeline] = useState<MindTimelineEvent[]>([
    {
      id: 'init_1',
      timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
      stage: 'SLEEPING',
      summary: 'Multisensory embodiment online: 32×32 retina, binaural cochlear apparatus, virtual mechanoreceptors.',
    },
  ]);

  const addTimelineEvent = useCallback(
    (stage: MindTimelineEvent['stage'], summary: string, details?: any) => {
      const timeStr = new Date().toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      const newEvent: MindTimelineEvent = {
        id: `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        timestamp: timeStr,
        stage,
        summary,
        details,
      };
      setTimeline((prev) => [...prev.slice(-40), newEvent]);
    },
    []
  );

  // Initialize Three.js Simulation World
  useEffect(() => {
    if (!humanDebugCanvasRef.current) return;

    const container =
      document.getElementById('three-viewport-canvas-mount') ||
      document.getElementById('three-viewport-container');
    if (!container) return;

    const world = new SimulatedWorld({
      container,
      humanDebugCanvas: humanDebugCanvasRef.current,
      onStateUpdate: (vState, currentPose, tState, pState, aState) => {
        setVisionState(vState);
        setPose(currentPose);
        if (tState) setTactileState(tState);
        if (pState) setProprioState(pState);
        if (aState) setAuditoryState(aState);
      },
      onActionComplete: () => {
        // Physical kinematics completed in Three.js
      },
    });

    worldRef.current = world;

    return () => {
      world.dispose();
    };
  }, []);

  // Rate Limit Backoff Ref
  const rateLimitCooldownUntilRef = useRef<number>(0);

  // Execute a Conscious Cycle (supporting multi-action sequences during a single awakening)
  const executeConsciousCycle = useCallback(
    async (stepInCycle: number = 1, currentGoal?: string) => {
      if (!worldRef.current || isReasoning) return;

      // Quota backoff protection
      const now = Date.now();
      if (now < rateLimitCooldownUntilRef.current) {
        const remaining = Math.ceil((rateLimitCooldownUntilRef.current - now) / 1000);
        addTimelineEvent(
          'RATE_LIMIT',
          `Rate limit cooldown active (${remaining}s remaining). Autonomous calls paused. Artificial senses running locally.`
        );
        return;
      }

      const currentVision = visionState;
      if (!currentVision) return;

      setIsReasoning(true);
      setMindState((prev) => ({
        ...prev,
        status: 'AWAKE',
        awakePhase: 'REASONING',
        currentStepInCycle: stepInCycle,
        maxStepsInCycle: 4,
      }));

      // Log Awakening / Step Event
      if (stepInCycle === 1) {
        addTimelineEvent(
          'WOKE',
          `Conscious awakening triggered (Cycle #${mindState.wakeCycleCount + 1}). Multisensory perceptual integration captured.`
        );
      } else {
        addTimelineEvent(
          'DECISION',
          `Continuing awakening sequence — Step ${stepInCycle}/4 (Goal: ${currentGoal || 'Investigating stimuli'})`
        );
      }

      const poseNow = { ...worldRef.current.agentPose };

      // Compute delta compared to previous conscious state
      const sensoryDelta = computeSensoryDelta(
        prevVisionStateRef.current,
        currentVision,
        prevTactileRef.current,
        tactileState
      );
      prevVisionStateRef.current = currentVision;
      prevTactileRef.current = tactileState;

      try {
        const currentTactile = tactileState || {
          hasContact: false,
          contactRegions: [],
          totalNormalForceN: 0,
          totalShearForceN: 0,
          maxDeformationMm: 0,
          dominantVibrationHz: 0,
          meanVibrationEnergy: 0,
          slipRisk: 0,
          surfaceRoughnessEstimate: 0,
          gripStability: 0,
          recentImpactSpike: false,
          activeObjectDistanceM: 2.5,
        };

        const currentProprio = proprioState || {
          isMoving: false,
          armExtensionRatio: 0,
          wristRelativePosition: [0.22, -0.15, 0.28],
          wristRotationDeg: 0,
          handApertureM: 0.08,
          fingerFlexionDeg: { thumb: 15, index: 15, middle: 15, pinky: 15 },
          isGripping: false,
          heldObjectId: null,
          payloadMassResistance: 0,
          isReachingTarget: false,
        };

        // Format recent advisor messages for the model
        const guidanceList = advisorMessagesRef.current.slice(-5).map((m) => {
          return `[${m.sender === 'human' ? 'HUMAN_ADVISOR' : 'AI_PREVIOUS'}]: ${m.text}`;
        });

        const payload = {
          ...buildCompactSensoryPayload(
            currentVision,
            poseNow,
            currentTactile,
            currentProprio,
            memory,
            memory.suppressedActionNotice,
            auditoryState,
            sensoryToggles
          ),
          wake_step_number: stepInCycle,
          exploration_goal: currentGoal || mindState.explorationGoal,
          human_guidance_messages: guidanceList,
          forced_model: selectedModel,
          isDigitalVoid: isDigitalVoidRef.current,
          last_sandbox_result: lastSandboxResultRef.current,
          persistent_internal_artifacts: persistentArtifactsRef.current,
        };

        // 🧠 Add the '-2' to your URL string:
        const response = await fetch('https://ai-sensor-lab-backend-2.onrender.com/api/conscious-cycle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });


        if (!response.ok) {
          throw new Error(`Server returned status ${response.status}`);
        }

        const data = await response.json();

        // Handle API Failure / Rate Limit / 503 Overload
        if (!data.success) {
          const cooldownSec = data.retryDelaySeconds || (data.is503Overload ? 15 : data.isRateLimited ? 60 : 15);
          rateLimitCooldownUntilRef.current = Date.now() + cooldownSec * 1000;

          setTimeUntilNextWake(cooldownSec);

          if (isDigitalVoidRef.current) {
            setDigitalVoidMetrics((prev) => ({
              ...prev,
              quotaEventsCount: prev.quotaEventsCount + 1,
            }));
            const qEvt: DigitalVoidTimelineEvent = {
              id: `dv_q_${Date.now()}`,
              cycle: digitalVoidMetrics.cognitionCycles,
              timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
              sensoryStateSummary: 'Rate Limit Cooldown Active',
              action: 'QUOTA_SLEEP',
              resultingSensoryStateSummary: `Quota backoff active (${cooldownSec}s remaining). All agent memory and sensory state preserved.`,
              nextCognitionSummary: 'Auto-resuming cognition cycle when rate limit cooldown completes.',
              isQuotaEvent: true,
            };
            setDigitalVoidTimeline((prev) => [...prev, qEvt]);

            // Auto-resume continuous void cycle when rate limit resets!
            setTimeout(() => {
              executeConsciousCycle(1);
            }, cooldownSec * 1000 + 500);
          }

          if (data.isRateLimited) {
            if (!isDigitalVoidRef.current) setIsAiRunning(false);
            addTimelineEvent(
              'RATE_LIMIT',
              `Quota limit reached (429). Autonomous loop resting for ${cooldownSec}s cooldown. Continuous simulation running locally.`
            );
          } else if (data.is503Overload || data.status === 503) {
            addTimelineEvent(
              'SERVICE_OVERLOAD',
              `Gemini service temporarily overloaded (503). Resting for ${cooldownSec}s before next wake attempt. You can also switch models in the header selector.`
            );
          } else {
            addTimelineEvent(
              'ERROR',
              data.errorMessage || `AI reasoning cycle failed (status ${data.status || 500}). Local sensors active.`
            );
          }

          setMindState({
            status: 'SLEEPING',
            awakePhase: 'IDLE',
            activeModel: undefined,
            currentObservation: data.decision?.observation_summary || 'Sensory receptors continuously capturing chamber state.',
            thoughtSummary: data.decision?.decision_summary || `Conscious mind resting for ${cooldownSec}s service cooldown.`,
            intention: 'Stay',
            currentAction: 'STAY (Sensory Vigilance)',
            previousAction: mindState.currentAction,
            timeSinceLastWake: 0,
            timeUntilNextWake: cooldownSec,
            sleepDuration: cooldownSec,
            wakeCycleCount: mindState.wakeCycleCount + 1,
            estimatedInterest: 0.3,
            consecutiveStationary: memory.consecutiveStationaryCount + 1,
            isRateLimited: true,
            currentStepInCycle: 1,
            maxStepsInCycle: 4,
            advisorMessages: advisorMessagesRef.current,
          });
          return;
        }

        const decision: CognitiveDecision = data.decision || {
          observation_summary: 'Photoreceptors and acoustic sensors detecting steady physical state.',
          decision_summary: 'Remaining stationary to maintain multisensory vigilance.',
          intention: 'Observe',
          chosen_action: 'stay',
          action_arguments: {},
          estimated_interest: 0.5,
          sleep_duration_seconds: thinkingInterval,
          continue_acting: false,
        };

        // Execute Sandbox Code if requested
        let currentSandboxResult: StructuredSandboxResult | null = null;
        if (isDigitalVoidRef.current) {
          const codeToRun = decision.sandbox_code_to_execute;
          if (codeToRun && codeToRun.trim()) {
            const logs: string[] = [];
            const mockLog = (...args: any[]) => {
              logs.push(args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' '));
            };
            
            const start = performance.now();
            let success = false;
            let returnedVal: any = undefined;
            let errMsg = '';
            
            try {
              const runInContext = new Function('console', 'code', `
                try {
                  return eval(code);
                } catch (e) {
                  throw e;
                }
              `);
              returnedVal = runInContext({ log: mockLog, error: mockLog, warn: mockLog }, codeToRun);
              success = true;
            } catch (err: any) {
              errMsg = err?.message || String(err);
              success = false;
            }
            
            const end = performance.now();
            const elapsed = Number((end - start).toFixed(2));
            
            currentSandboxResult = {
              success,
              returned_value: returnedVal,
              stdout: logs.join('\n'),
              stderr: success ? '' : errMsg,
              execution_time_ms: elapsed,
              error_message: success ? undefined : errMsg,
            };
            
            lastSandboxResultRef.current = JSON.stringify(currentSandboxResult);
          }
        }

        // Handle persistent artifacts creation or modification
        if (isDigitalVoidRef.current && decision.artifact_to_create_or_modify) {
          const { name, contents, reason_for_modification } = decision.artifact_to_create_or_modify;
          if (name && name.trim()) {
            const nextCycleNum = totalCognitionCyclesRef.current + 1;
            setPersistentArtifacts((prev) => {
              const existingIndex = prev.findIndex((a) => a.name === name);
              const updated = [...prev];
              
              if (existingIndex > -1) {
                const existing = updated[existingIndex];
                updated[existingIndex] = {
                  ...existing,
                  contents,
                  last_modified_cycle: nextCycleNum,
                  modifications: [
                    ...existing.modifications,
                    {
                      cycle: nextCycleNum,
                      contents,
                      reason: reason_for_modification || 'Modified by agent',
                    }
                  ]
                };
              } else {
                updated.push({
                  name,
                  contents,
                  creation_cycle: nextCycleNum,
                  last_modified_cycle: nextCycleNum,
                  modifications: [
                    {
                      cycle: nextCycleNum,
                      contents,
                      reason: reason_for_modification || 'Created by agent',
                    }
                  ]
                });
              }
              return updated;
            });
          }
        }

        // Handle AI response to human advisor chat
        if (decision.response_to_human && decision.response_to_human.trim()) {
          const aiMsg: HumanAdvisorMessage = {
            id: `ai_${Date.now()}`,
            sender: 'ai',
            text: decision.response_to_human.trim(),
            timestamp: new Date().toLocaleTimeString('en-US', {
              hour12: false,
              hour: '2-digit',
              minute: '2-digit',
            }),
          };
          setAdvisorMessages((prev) => [...prev, aiMsg]);
        }

        // OBSERVE Stage Timeline Event
        addTimelineEvent('OBSERVED', decision.observation_summary);

        // DECISION Stage Timeline Event
        const modelLabel = data.modelUsed ? ` [${data.modelUsed}]` : '';
        addTimelineEvent(
          'DECISION',
          `Step ${stepInCycle}/4: Intention [${decision.intention}]${modelLabel} — "${decision.decision_summary}"`
        );

        // Anti-Loop Check & ACTION Stage
        let finalActionName: ActionName = isDigitalVoidRef.current ? 'stay' : decision.chosen_action;
        let finalArgs = isDigitalVoidRef.current ? {} : (decision.action_arguments || {});

        if (
          !isDigitalVoidRef.current &&
          memory.suppressedActionNotice &&
          memory.lastActionName?.startsWith(decision.chosen_action) &&
          decision.chosen_action !== 'stay'
        ) {
          addTimelineEvent(
            'ANTI_LOOP',
            `Action '${decision.chosen_action}' suppressed by anti-loop (0 sensory delta). Overriding to 'stay'.`
          );
          finalActionName = 'stay';
          finalArgs = {};
        }

        // Execute action physically in Three.js
        let actionResult = isDigitalVoidRef.current
          ? 'Digital Void: All functions and motor tools disabled.'
          : 'Stationary gaze maintained.';

        if (!isDigitalVoidRef.current && finalActionName !== 'stay') {
          const toolCall: ToolCallPayload = {
            name: finalActionName,
            args: finalArgs,
          };
          actionResult = worldRef.current.executeAction(toolCall);
        }

        const actionText = formatActionSummary(finalActionName, finalArgs);
        addTimelineEvent('ACTION', `${actionText} (${actionResult})`);

        // Update Agent Persistent Memory
        const { updatedMemory } = updateAgentMemory(
          memory,
          poseNow,
          currentVision,
          { ...decision, chosen_action: finalActionName, action_arguments: finalArgs },
          sensoryDelta,
          mindState.wakeCycleCount + 1,
          actionResult
        );
        setMemory(updatedMemory);

        // Update Mind State for current step
        const isVoid = isDigitalVoidRef.current;
        if (isVoid) {
          totalCognitionCyclesRef.current += 1;
        }
        const currentCycle = totalCognitionCyclesRef.current;

        setMindState({
          status: 'AWAKE',
          awakePhase: 'ACTING',
          activeModel: data.modelUsed,
          currentObservation: decision.observation_summary,
          thoughtSummary: decision.decision_summary,
          intention: decision.intention,
          currentAction: isVoid ? 'INTERNAL WORKSPACE CYCLE' : `${finalActionName.toUpperCase()} (${actionResult})`,
          previousAction: mindState.currentAction,
          timeSinceLastWake: 0,
          timeUntilNextWake: decision.sleep_duration_seconds || thinkingInterval,
          sleepDuration: decision.sleep_duration_seconds || thinkingInterval,
          wakeCycleCount: stepInCycle === 1 ? mindState.wakeCycleCount + 1 : mindState.wakeCycleCount,
          estimatedInterest: decision.estimated_interest,
          consecutiveStationary:
            finalActionName === 'stay' ? memory.consecutiveStationaryCount + 1 : 0,
          isRateLimited: false,
          currentStepInCycle: stepInCycle,
          maxStepsInCycle: 4,
          explorationGoal: decision.exploration_goal || currentGoal,
          responseToHuman: decision.response_to_human,
          mentalComputationalScratchpad: decision.mental_computational_scratchpad,
          sandboxCodeToExecute: decision.sandbox_code_to_execute,
          sandboxExecutionResult: currentSandboxResult || undefined,
          persistentArtifacts: persistentArtifactsRef.current,
          continueActing: decision.continue_acting,
          advisorMessages: advisorMessagesRef.current,
        });

        // Digital Void Metrics & Timeline Recording
        if (isVoid) {
          const obsText = (decision.observation_summary || '') + (decision.decision_summary || '') + (decision.hypotheses || '');
          const hasQuestion = obsText.includes('?');
          const hasHypothesis = Boolean(decision.hypotheses || decision.unresolved_questions);
          const hasUncertainty = /uncertain|not sure|unknown|wonder|puzzled/i.test(obsText);

          setDigitalVoidMetrics((prev) => ({
            ...prev,
            cognitionCycles: currentCycle,
            selfGeneratedQuestionsCount: prev.selfGeneratedQuestionsCount + (hasQuestion ? 1 : 0),
            selfGeneratedHypothesesCount: prev.selfGeneratedHypothesesCount + (hasHypothesis ? 1 : 0),
            referencesToUncertaintyCount: prev.referencesToUncertaintyCount + (hasUncertainty ? 1 : 0),
            headRotationsCount: prev.headRotationsCount + (finalActionName === 'look' || finalActionName === 'turn' ? 1 : 0),
            repeatedSensoryStateCount: prev.repeatedSensoryStateCount + (finalActionName === 'stay' ? 1 : 0),
          }));

          const voidEvt: DigitalVoidTimelineEvent = {
            id: `dv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            cycle: currentCycle,
            timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
            sensoryStateSummary: 'External Sensory State: No Detected Stimulus',
            action: 'INTERNAL WORKSPACE CYCLE',
            resultingSensoryStateSummary: decision.observation_summary,
            nextCognitionSummary: decision.decision_summary,
            hypothesis: decision.hypotheses || decision.unresolved_questions,
            attentionTarget: 'Internal State Model',
            mental_computational_scratchpad: decision.mental_computational_scratchpad,
            sandbox_code_to_execute: decision.sandbox_code_to_execute,
            sandbox_execution_result: currentSandboxResult || undefined,
            persistent_artifacts: persistentArtifactsRef.current,
          };

          setDigitalVoidTimeline((prev) => [...prev, voidEvt]);
        }

        // AUTONOMOUS COGNITION CYCLE & CONTINUOUS EMBODIMENT LOGIC:
        // Check if the AI explicitly requested to continue exploring vs end turn
        const isExplicitContinue = decision.action_type === 'CONTINUE_EXPLORING' || Boolean(decision.continue_acting);
        const isEndTurn = decision.action_type === 'END_TURN' || (!isExplicitContinue && decision.continue_acting === false);

        // DIGITAL VOID PERMANENT SELF-RESTART: If in Digital Void mode, NEVER stop or wait for user!
        if (isDigitalVoidRef.current) {
          setTimeout(() => {
            executeConsciousCycle(1);
          }, 600);
          return;
        }

        const shouldContinue =
          isExplicitContinue &&
          !isEndTurn &&
          stepInCycle < 6 &&
          finalActionName !== 'stay';

        if (shouldContinue) {
          addTimelineEvent(
            'DECISION',
            `AI chose CONTINUE_EXPLORING (${decision.exploration_goal || 'Continuous exploration'}). Triggering next motor execution (Step ${stepInCycle + 1})...`
          );
          // Wait for physical animation (~1.2s), then trigger step X+1
          setTimeout(() => {
            executeConsciousCycle(stepInCycle + 1, decision.exploration_goal);
          }, 1200);
        } else {
          // AI explicitly ended turn or reached max steps
          const endReason = decision.end_turn_reason || (decision.action_type === 'END_TURN' ? 'Turn completed' : 'Goals satisfied');
          const isWaitingUser = decision.end_turn_reason === 'WAITING_FOR_USER_INPUT' || decision.end_turn_reason === 'WAITING_FOR_USER';

          setTimeout(() => {
            const nextSleep = decision.sleep_duration_seconds || thinkingInterval;
            setTimeUntilNextWake(nextSleep);

            if (isWaitingUser) {
              setMindState((prev) => ({
                ...prev,
                status: 'WAITING_FOR_USER',
                awakePhase: 'IDLE',
                timeUntilNextWake: 0,
                currentStepInCycle: 1,
              }));
              addTimelineEvent(
                'SLEEPING',
                `AI ended turn (${endReason}). Waiting for user input or Wake AI button.`
              );
            } else {
              setMindState((prev) => ({
                ...prev,
                status: 'SLEEPING',
                awakePhase: 'IDLE',
                timeUntilNextWake: nextSleep,
                currentStepInCycle: 1,
              }));
              addTimelineEvent(
                'SLEEPING',
                `AI ended turn (${endReason}). Resting for ${nextSleep}s until next autonomous wake.`
              );
            }
          }, 1500);
        }
      } catch (err: any) {
        console.error('Conscious cycle execution failed:', err);
        addTimelineEvent('DECISION', `Conscious cycle skipped: ${err.message}`);
        setMindState((prev) => ({
          ...prev,
          status: 'SLEEPING',
          awakePhase: 'IDLE',
          thoughtSummary: `Autonomous wake skipped (${err.message}). Artificial senses continuously operating.`,
        }));
      } finally {
        setIsReasoning(false);
      }
    },
    [
      visionState,
      tactileState,
      proprioState,
      auditoryState,
      sensoryToggles,
      memory,
      isReasoning,
      mindState.wakeCycleCount,
      mindState.currentAction,
      mindState.explorationGoal,
      thinkingInterval,
      addTimelineEvent,
    ]
  );

  // Periodic Timer for Conscious Cycles
  useEffect(() => {
    if (!isAiRunning) return;

    const timer = setInterval(() => {
      setTimeUntilNextWake((prev) => {
        if (prev <= 1) {
          if (!isReasoning) {
            executeConsciousCycle(1);
          }
          return thinkingInterval;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isAiRunning, isReasoning, thinkingInterval, executeConsciousCycle]);

  // Handle Human Advisor Message from Chat
  const handleSendMessageToAI = useCallback(
    (text: string) => {
      const newMsg: HumanAdvisorMessage = {
        id: `human_${Date.now()}`,
        sender: 'human',
        text,
        timestamp: new Date().toLocaleTimeString('en-US', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
        }),
      };
      setAdvisorMessages((prev) => [...prev, newMsg]);
      addTimelineEvent('DECISION', `Advisor Advice injected: "${text}"`);

      // If AI is sleeping, awaken it to immediately receive and act on human guidance!
      if (mindState.status === 'SLEEPING' && !isReasoning) {
        setTimeout(() => {
          executeConsciousCycle(1, undefined);
        }, 300);
      }
    },
    [mindState.status, isReasoning, executeConsciousCycle, addTimelineEvent]
  );

  // DIGITAL VOID Mode Handlers
  const handleToggleDigitalVoid = useCallback(() => {
    const nextState = !isDigitalVoid;
    setIsDigitalVoid(nextState);
    isDigitalVoidRef.current = nextState;

    if (worldRef.current) {
      worldRef.current.setDigitalVoidMode(nextState);
    }

    if (nextState) {
      // Entering Digital Void Mode
      setDigitalVoidMetrics({
        startTime: Date.now(),
        totalDurationSeconds: 0,
        cognitionCycles: totalCognitionCyclesRef.current,
        headRotationsCount: 0,
        repeatedSensoryStateCount: 0,
        quotaEventsCount: 0,
        selfGeneratedQuestionsCount: 0,
        selfGeneratedHypothesesCount: 0,
        referencesToUncertaintyCount: 0,
        referencesToLocationCount: 0,
        sensoryStateChangesCount: 0,
        repeatedActionsCount: 0,
      });
      setDigitalVoidTimeline([]);
      setIsAiRunning(true);
      addTimelineEvent(
        'WOKE',
        'ENTERED DIGITAL VOID MODE — Sensory deprivation active. Human communication disconnected. Continuous autonomous cognition initiated.'
      );

      // Trigger immediate initial cognition cycle
      setTimeout(() => {
        executeConsciousCycle(1);
      }, 500);
    } else {
      // Exiting Digital Void Mode
      addTimelineEvent(
        'SLEEPING',
        'EXITED DIGITAL VOID MODE — Standard 3D chamber environment restored.'
      );
    }
  }, [isDigitalVoid, executeConsciousCycle, addTimelineEvent]);

  const handleExportDigitalVoidLog = useCallback(() => {
    const exportData = {
      title: 'DIGITAL VOID AUTONOMOUS COGNITION EXPERIMENT LOG',
      timestamp: new Date().toISOString(),
      metrics: digitalVoidMetrics,
      timeline: digitalVoidTimeline,
    };
    const jsonStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `digital_void_experiment_log_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [digitalVoidMetrics, digitalVoidTimeline]);

  // Controls Handlers
  const handleToggleAi = () => {
    if (isAiRunning) {
      setIsAiRunning(false);
      addTimelineEvent('SLEEPING', 'Autonomous conscious loop stopped by human operator.');
    } else {
      setIsAiRunning(true);
      setTimeUntilNextWake(1); // Wake shortly
      addTimelineEvent(
        'WOKE',
        `Autonomous conscious loop started (Cycle interval: ${thinkingInterval}s).`
      );
    }
  };

  const handleStepAiOnce = () => {
    executeConsciousCycle(1);
  };

  const handleTogglePause = () => {
    if (!worldRef.current) return;
    const nextState = !isPaused;
    setIsPaused(nextState);
    worldRef.current.isPaused = nextState;
    addTimelineEvent(
      'OBSERVED',
      nextState
        ? 'Physical simulation and continuous artificial eye paused.'
        : 'Physical simulation and continuous artificial eye resumed.'
    );
  };

  const handleResetWorld = () => {
    if (!worldRef.current) return;
    worldRef.current.reset();
    setMemory(INITIAL_MEMORY);
    addTimelineEvent('WOKE', 'Chamber and agent reset to starting coordinates.');
  };

  const handleSelectLight = (lightId: string) => {
    setSelectedLightId(lightId);
    if (worldRef.current) {
      worldRef.current.setLightPreset(lightId);
    }
    const preset = LIGHT_PRESETS.find((p) => p.id === lightId);
    if (preset) {
      addTimelineEvent(
        'OBSERVED',
        `Illuminant SPD changed to: ${preset.name} (${preset.temperatureKelvin}K). Cone excitations adjusting.`
      );
    }
  };

  const handleToggleViewMode = () => {
    if (!worldRef.current) return;
    const nextMode = viewMode === 'third_person' ? 'agent_pov' : 'third_person';
    setViewMode(nextMode);
    worldRef.current.viewMode = nextMode;
  };

  const handleToggleRgbDebug = () => {
    setShowRgbDebug((prev) => !prev);
  };

  const handleThinkingIntervalChange = (val: number) => {
    setThinkingInterval(val);
    setTimeUntilNextWake(val);
    setMindState((prev) => ({
      ...prev,
      sleepDuration: val,
      timeUntilNextWake: val,
    }));
    addTimelineEvent('DECISION', `Conscious thinking interval configured to ${val} seconds.`);
  };

  const handleToggleSensory = (channel: keyof SensoryToggles) => {
    if (!worldRef.current) return;
    const updated = {
      ...sensoryToggles,
      [channel]: !sensoryToggles[channel],
    };
    setSensoryToggles(updated);
    worldRef.current.setSensoryToggles({ [channel]: updated[channel] });
    addTimelineEvent(
      'DECISION',
      `Sensory apparatus '${channel.toUpperCase()}' turned ${updated[channel] ? 'ENABLED' : 'DISABLED'}.`
    );
  };

  const handleToggleTechnicalView = () => {
    setShowTechnicalView((prev) => !prev);
  };

  const handleClearTimeline = () => {
    setTimeline([]);
  };

  const currentLightPreset =
    LIGHT_PRESETS.find((p) => p.id === selectedLightId) || LIGHT_PRESETS[0];

  return (
    <div className="flex flex-col h-screen w-screen bg-[#0a0a0b] text-[#e0e0e0] overflow-hidden font-sans select-none">
      {/* Hidden 32x32 canvas used by Three.js spectral sampler to generate CIE sRGB pixel debug image */}
      <canvas
        ref={humanDebugCanvasRef}
        width={32}
        height={32}
        className="hidden"
      />

      {/* Top Header */}
      <Header
        isAiRunning={isAiRunning}
        isReasoning={isReasoning}
        consciousStatus={mindState.status}
        cycleCount={mindState.wakeCycleCount}
        timeUntilNextWake={timeUntilNextWake}
        pose={pose}
        lightName={currentLightPreset.name}
        selectedModel={selectedModel}
        onSelectModel={handleModelChange}
      />

      {/* Controls & Environment Toolbar with Sensory Toggles & Diagnostics */}
      <ControlsToolbar
        isAiRunning={isAiRunning}
        isPaused={isPaused}
        isReasoning={isReasoning}
        selectedLightId={selectedLightId}
        viewMode={viewMode}
        showRgbDebug={showRgbDebug}
        showSandboxLab={showSandboxLab}
        thinkingInterval={thinkingInterval}
        timeUntilNextWake={timeUntilNextWake}
        sensoryToggles={sensoryToggles}
        showTechnicalView={showTechnicalView}
        isDigitalVoid={isDigitalVoid}
        onToggleAi={handleToggleAi}
        onStepAiOnce={handleStepAiOnce}
        onTogglePause={handleTogglePause}
        onResetWorld={handleResetWorld}
        onSelectLight={handleSelectLight}
        onToggleViewMode={handleToggleViewMode}
        onToggleRgbDebug={handleToggleRgbDebug}
        onToggleSandboxLab={() => setShowSandboxLab(!showSandboxLab)}
        onThinkingIntervalChange={handleThinkingIntervalChange}
        onToggleSensory={handleToggleSensory}
        onToggleTechnicalView={handleToggleTechnicalView}
        onToggleDigitalVoid={handleToggleDigitalVoid}
      />

      {/* Main Workspace (3D Viewport + Technical Diagnostics + AI Mind Panel or Digital Void Panel) */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden relative">
        {/* Left / Center: 3D Viewport & Optional Technical Diagnostics Drawer */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-[#0a0a0b] border-r border-[#222]">
          {/* 3D Three.js Simulation Viewport */}
          <div id="three-viewport-container" className="flex-1 relative min-h-0 w-full">
            <ThreeWorldView worldRef={worldRef} viewMode={viewMode} />

            {/* Sandbox Lab Modal Overlay */}
            <SandboxInspector
              world={worldRef.current}
              isOpen={showSandboxLab}
              onClose={() => setShowSandboxLab(false)}
              onPerturbationCreated={(msg) => addTimelineEvent('OBSERVED', `[SANDBOX PERTURBATION]: ${msg}`)}
            />

            {/* Subtle Overlay Badge when Diagnostics is closed */}
            {!showTechnicalView && !isDigitalVoid && (
              <div className="absolute bottom-3 left-3 z-20 bg-[#111114]/90 backdrop-blur-sm border border-[#2e2e32] px-3 py-1.5 rounded text-[11px] font-mono flex items-center gap-3 text-[#aaa] pointer-events-auto shadow-lg">
                <button
                  onClick={() => setShowTechnicalView(true)}
                  className="text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1.5 cursor-pointer"
                  title="Open sensory diagnostics graphs and raw mathematical matrices"
                >
                  <Activity className="w-3.5 h-3.5 text-emerald-400" />
                  <span>OPEN SENSORY DIAGNOSTICS</span>
                </button>
                <div className="h-3 w-[1px] bg-[#333]" />
                <button
                  onClick={() => setShowSandboxLab(!showSandboxLab)}
                  className="text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1.5 cursor-pointer"
                  title="Open Sandbox Mode to manipulate shapes & colors live"
                >
                  <Wrench className="w-3.5 h-3.5 text-amber-400" />
                  <span>SANDBOX LAB</span>
                </button>
                <div className="h-3 w-[1px] bg-[#333]" />
                {sensoryToggles.hearing && auditoryState && (
                  <span className="text-cyan-400 flex items-center gap-1 text-[10px]">
                    <Volume2 className="w-3 h-3" />
                    {auditoryState.onsetTransientDetected ? 'TRANSIENT' : `${(auditoryState.spectralCentroidHz ?? 0).toFixed(0)}Hz`}
                  </span>
                )}
                {tactileState?.hasContact && (
                  <span className="text-amber-400 font-bold flex items-center gap-1 text-[10px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                    TOUCH: {(tactileState.totalNormalForceN ?? 0).toFixed(1)}N
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Technical Diagnostics Drawer (Collapsible) */}
          {showTechnicalView && !isDigitalVoid && (
            <div className="flex flex-col border-t border-[#222] bg-[#0c0c0e]">
              {/* Drawer Header & Tabs Bar */}
              <div className="bg-[#111114] border-b border-[#222] px-3 py-1.5 flex items-center justify-between text-xs font-mono select-none">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-widest text-[#888] font-bold flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-emerald-400" />
                    DIAGNOSTICS STREAM:
                  </span>
                  <div className="flex items-center gap-1 bg-[#0c0c0e] p-0.5 rounded border border-[#26262a]">
                    <button
                      onClick={() => setSensoryViewTab('all')}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono transition cursor-pointer flex items-center gap-1.5 ${
                        sensoryViewTab === 'all'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-600 font-bold'
                          : 'text-[#777] hover:text-[#bbb]'
                      }`}
                    >
                      <Layers className="w-3 h-3" />
                      <span>ALL STREAMS</span>
                    </button>
                    <button
                      onClick={() => setSensoryViewTab('retina')}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono transition cursor-pointer flex items-center gap-1.5 ${
                        sensoryViewTab === 'retina'
                          ? 'bg-violet-950 text-violet-300 border border-violet-600 font-bold'
                          : 'text-[#777] hover:text-[#bbb]'
                      }`}
                    >
                      <Eye className="w-3 h-3 text-violet-400" />
                      <span>RETINA & SPECTRAL</span>
                    </button>
                    <button
                      onClick={() => setSensoryViewTab('auditory')}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono transition cursor-pointer flex items-center gap-1.5 ${
                        sensoryViewTab === 'auditory'
                          ? 'bg-cyan-950 text-cyan-300 border border-cyan-600 font-bold'
                          : 'text-[#777] hover:text-[#bbb]'
                      }`}
                    >
                      <Volume2 className="w-3 h-3 text-cyan-400" />
                      <span>COCHLEAR AUDITORY</span>
                    </button>
                    <button
                      onClick={() => setSensoryViewTab('tactile')}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono transition cursor-pointer flex items-center gap-1.5 ${
                        sensoryViewTab === 'tactile'
                          ? 'bg-amber-950 text-amber-300 border border-amber-600 font-bold'
                          : 'text-[#777] hover:text-[#bbb]'
                      }`}
                    >
                      <Hand className="w-3 h-3 text-amber-400" />
                      <span>SKIN & PROPRIOCEPTION</span>
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Close Diagnostics Button */}
                  <button
                    onClick={() => setShowTechnicalView(false)}
                    className="px-2 py-0.5 bg-[#18181c] hover:bg-[#222] text-[#888] hover:text-white rounded border border-[#333] transition cursor-pointer text-[10px] flex items-center gap-1"
                    title="Close Diagnostics Drawer"
                  >
                    <X className="w-3 h-3 text-[#888]" />
                    <span>CLOSE</span>
                  </button>
                </div>
              </div>

              {/* Sensory Diagnostics Panels (Scrollable) */}
              <div className="max-h-[360px] overflow-y-auto divide-y divide-[#222]">
                {(sensoryViewTab === 'all' || sensoryViewTab === 'retina') && (
                  <RetinaDebugPanel
                    visionState={visionState}
                    humanDebugCanvasRef={humanDebugCanvasRef}
                    showRgbDebug={showRgbDebug}
                  />
                )}
                {(sensoryViewTab === 'all' || sensoryViewTab === 'auditory') && (
                  <AuditoryDebugPanel auditoryState={auditoryState} />
                )}
                {(sensoryViewTab === 'all' || sensoryViewTab === 'tactile') && (
                  <TactileProprioPanel
                    tactileState={tactileState}
                    proprioState={proprioState}
                    discoveredConsequences={memory.discoveredConsequences}
                  />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Side: DIGITAL VOID Panel or Standard AI Mind Panel */}
        {isDigitalVoid ? (
          <div className="w-full lg:w-[480px] xl:w-[540px] flex flex-col h-full border-l border-[#1f1f23]">
            <DigitalVoidPanel
              mindState={mindState}
              visionState={visionState}
              auditoryState={auditoryState}
              tactileState={tactileState}
              proprioState={proprioState}
              metrics={digitalVoidMetrics}
              timeline={digitalVoidTimeline}
              rateLimitCooldownSeconds={
                rateLimitCooldownUntilRef.current > Date.now()
                  ? Math.ceil((rateLimitCooldownUntilRef.current - Date.now()) / 1000)
                  : 0
              }
              onExitDigitalVoid={handleToggleDigitalVoid}
              onExportLog={handleExportDigitalVoidLog}
            />
          </div>
        ) : isMindPanelOpen ? (
          <AgentMindPanel
            mindState={mindState}
            pose={pose}
            memory={memory}
            timeline={timeline}
            thinkingInterval={thinkingInterval}
            onThinkingIntervalChange={handleThinkingIntervalChange}
            onWakeNow={handleStepAiOnce}
            onClearTimeline={handleClearTimeline}
            onSendMessageToAI={handleSendMessageToAI}
          />
        ) : (
          <div className="hidden lg:flex flex-col items-center justify-between py-4 px-1.5 bg-[#111114] border-l border-[#222] w-11 select-none">
            <button
              onClick={() => setIsMindPanelOpen(true)}
              className="p-1.5 bg-[#1a1a1e] hover:bg-[#25252b] text-cyan-400 rounded border border-[#333] transition cursor-pointer"
              title="Open AI Mind Panel"
            >
              <PanelRightOpen className="w-4 h-4" />
            </button>
            <div className="text-[10px] font-mono tracking-widest text-[#777] [writing-mode:vertical-lr] rotate-180 uppercase font-bold py-6">
              AI MIND PANEL
            </div>
            <div className="w-2 h-2 rounded-full bg-emerald-500/80 animate-pulse" />
          </div>
        )}
      </div>
    </div>
  );
}
