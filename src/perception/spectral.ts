/**
 * Spectral physics and photoreceptor cone models for Artificial Eye
 *
 * Implements:
 * - 31 spectral bands (400nm to 700nm at 10nm resolution)
 * - Physiological S/M/L cone sensitivity fundamentals (Stockman & Sharpe approximation)
 * - Light source Spectral Power Distributions (SPD)
 * - Material spectral reflectance functions R(λ)
 * - Incident radiance calculation and cone integration
 * - Photoreceptor adaptation (Naka-Rushton hyperbolic compression)
 * - CIE XYZ to sRGB conversion for Human Debug rendering
 */

export const WAVELENGTHS = [
  400, 410, 420, 430, 440, 450, 460, 470, 480, 490,
  500, 510, 520, 530, 540, 550, 560, 570, 580, 590,
  600, 610, 620, 630, 640, 650, 660, 670, 680, 690, 700
];

export const NUM_BANDS = WAVELENGTHS.length; // 31

/**
 * Normalized 7 Photoreceptor Spectral Sensitivity Curves
 * Biologically inspired, overlapping spectral sensitivity curves across 31 wavelength bands (400nm to 700nm):
 * 1. UV: Ultraviolet-sensitive (peak ~360nm; tail into 400-420nm)
 * 2. S: Short visible wavelengths (peak ~440nm, blue-violet)
 * 3. S2: Intermediate short-medium wavelengths (peak ~480nm, cyan / blue-green transition)
 * 4. M: Medium visible wavelengths (peak ~540nm, green)
 * 5. M2: Intermediate medium-long wavelengths (peak ~580nm, yellow-amber transition)
 * 6. L: Long visible wavelengths (peak ~620nm, red / crimson)
 * 7. NIR: Near-infrared-sensitive (peak ~850nm; tail in 680-700nm)
 */
export const UV_CONE_SENSITIVITY: number[] = [
  0.720, 0.450, 0.220, 0.080, 0.025, 0.008, 0.002, 0.000, 0.000, 0.000,
  0.000, 0.000, 0.000, 0.000, 0.000, 0.000, 0.000, 0.000, 0.000, 0.000,
  0.000, 0.000, 0.000, 0.000, 0.000, 0.000, 0.000, 0.000, 0.000, 0.000, 0.000
];

export const S_CONE_SENSITIVITY: number[] = [
  0.038, 0.120, 0.380, 0.760, 0.980, 1.000, 0.880, 0.650, 0.410, 0.220,
  0.098, 0.040, 0.015, 0.005, 0.002, 0.001, 0.000, 0.000, 0.000, 0.000,
  0.000, 0.000, 0.000, 0.000, 0.000, 0.000, 0.000, 0.000, 0.000, 0.000, 0.000
];

export const S2_CONE_SENSITIVITY: number[] = [
  0.005, 0.015, 0.050, 0.150, 0.380, 0.720, 0.940, 1.000, 0.920, 0.740,
  0.500, 0.300, 0.160, 0.080, 0.035, 0.015, 0.005, 0.001, 0.000, 0.000,
  0.000, 0.000, 0.000, 0.000, 0.000, 0.000, 0.000, 0.000, 0.000, 0.000, 0.000
];

export const M_CONE_SENSITIVITY: number[] = [
  0.001, 0.002, 0.007, 0.018, 0.042, 0.088, 0.160, 0.280, 0.440, 0.650,
  0.840, 0.960, 1.000, 0.980, 0.910, 0.800, 0.660, 0.510, 0.370, 0.240,
  0.150, 0.088, 0.050, 0.027, 0.014, 0.007, 0.003, 0.001, 0.001, 0.000, 0.000
];

export const M2_CONE_SENSITIVITY: number[] = [
  0.000, 0.000, 0.001, 0.003, 0.010, 0.025, 0.050, 0.100, 0.180, 0.320,
  0.520, 0.740, 0.900, 0.980, 1.000, 0.950, 0.850, 0.700, 0.520, 0.360,
  0.220, 0.120, 0.060, 0.030, 0.012, 0.005, 0.002, 0.000, 0.000, 0.000, 0.000
];

export const L_CONE_SENSITIVITY: number[] = [
  0.001, 0.002, 0.004, 0.010, 0.024, 0.051, 0.096, 0.170, 0.280, 0.430,
  0.600, 0.770, 0.890, 0.960, 1.000, 0.980, 0.910, 0.800, 0.670, 0.520,
  0.390, 0.270, 0.180, 0.110, 0.065, 0.036, 0.019, 0.009, 0.004, 0.002, 0.001
];

export const NIR_CONE_SENSITIVITY: number[] = [
  0.000, 0.000, 0.000, 0.000, 0.000, 0.000, 0.000, 0.000, 0.000, 0.000,
  0.000, 0.000, 0.000, 0.000, 0.000, 0.000, 0.000, 0.000, 0.000, 0.000,
  0.000, 0.000, 0.001, 0.002, 0.008, 0.025, 0.080, 0.220, 0.500, 0.850, 1.000
];

/**
 * CIE 1931 Standard Observer Color Matching Functions x_bar, y_bar, z_bar
 * Used strictly to project physical spectrum to accurate human RGB for debugging
 */
export const CIE_Y_BAR: number[] = [
  0.0004, 0.0012, 0.0040, 0.0116, 0.023, 0.038, 0.060, 0.091, 0.139, 0.208,
  0.323, 0.503, 0.710, 0.862, 0.954, 0.995, 0.995, 0.952, 0.870, 0.757,
  0.631, 0.503, 0.381, 0.265, 0.175, 0.107, 0.061, 0.032, 0.017, 0.008, 0.004
];

/**
 * Light Source Spectral Power Distributions (SPD)
 */
export interface LightPresetData {
  id: string;
  name: string;
  description: string;
  colorHex: string;
  spectrum: number[]; // 31 values (400-700nm)
  uvPower: number; // UV power factor (~320-380nm)
  nirPower: number; // Near-IR power factor (~750-950nm)
  temperatureKelvin: number;
}

export const LIGHT_PRESETS: LightPresetData[] = [
  {
    id: 'd65_daylight',
    name: 'Daylight (D65 ~6500K)',
    description: 'Standard natural daylight spectrum with strong UV component',
    colorHex: '#f6f9ff',
    spectrum: [
      0.82, 0.86, 0.92, 0.95, 1.02, 1.04, 1.05, 1.04, 1.02, 1.01,
      0.99, 0.98, 0.97, 0.96, 0.95, 0.94, 0.93, 0.92, 0.90, 0.89,
      0.88, 0.87, 0.86, 0.85, 0.84, 0.83, 0.82, 0.81, 0.80, 0.79, 0.78
    ],
    uvPower: 1.15,
    nirPower: 0.82,
    temperatureKelvin: 6500
  },
  {
    id: 'tungsten_2800k',
    name: 'Warm Incandescent (2800K)',
    description: 'Blackbody thermal radiator with strong long-wavelength and NIR emission',
    colorHex: '#ffeedd',
    spectrum: [
      0.15, 0.18, 0.22, 0.26, 0.31, 0.37, 0.44, 0.51, 0.59, 0.68,
      0.78, 0.88, 0.99, 1.10, 1.22, 1.34, 1.46, 1.58, 1.70, 1.82,
      1.93, 2.04, 2.15, 2.25, 2.34, 2.43, 2.50, 2.57, 2.63, 2.68, 2.72
    ],
    uvPower: 0.12,
    nirPower: 2.40,
    temperatureKelvin: 2800
  },
  {
    id: 'cool_fluorescent',
    name: 'Cool White Fluorescent / LED (4500K)',
    description: 'Characteristic phosphors with prominent short & medium peaks',
    colorHex: '#f0f5ff',
    spectrum: [
      0.45, 0.60, 0.75, 0.95, 1.35, 1.10, 0.70, 0.60, 0.55, 0.65,
      0.85, 1.15, 1.40, 1.45, 1.30, 1.10, 0.95, 0.85, 0.80, 0.75,
      0.70, 0.65, 0.60, 0.55, 0.50, 0.45, 0.40, 0.35, 0.30, 0.25, 0.20
    ],
    uvPower: 0.35,
    nirPower: 0.45,
    temperatureKelvin: 4500
  },
  {
    id: 'sodium_narrow',
    name: 'Sodium Vapor (589nm Quasi-Monochromatic)',
    description: 'Extremely sharp emission doublet at 589nm, low UV and NIR',
    colorHex: '#ffae00',
    spectrum: [
      0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01,
      0.02, 0.02, 0.03, 0.04, 0.06, 0.08, 0.15, 0.30, 0.80, 3.20,
      0.60, 0.15, 0.05, 0.02, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01
    ],
    uvPower: 0.02,
    nirPower: 0.25,
    temperatureKelvin: 2100
  },
  {
    id: 'blue_actinic',
    name: 'Deep Blue Actinic / UV (380-450nm)',
    description: 'High-energy short-wavelength and near-UV dominant illumination',
    colorHex: '#7faaff',
    spectrum: [
      0.30, 0.65, 1.20, 1.80, 2.50, 2.40, 1.70, 0.90, 0.40, 0.20,
      0.10, 0.08, 0.05, 0.04, 0.03, 0.02, 0.02, 0.01, 0.01, 0.01,
      0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01
    ],
    uvPower: 2.20,
    nirPower: 0.05,
    temperatureKelvin: 12000
  }
];

/**
 * Material Spectral Reflectance Profiles R(λ) ∈ [0, 1] + UV, NIR, & Thermal Emissivity
 */
export interface MaterialSpectralProfile {
  id: string;
  name: string;
  description: string;
  reflectance: number[]; // 31 values between 0 and 1
  approxHex: string;
  uvReflectance: number; // UV reflectance (~320-380nm)
  nirReflectance: number; // Near-IR reflectance (~750-950nm)
  baseTemperatureKelvin: number; // Surface temperature in Kelvin (ambient ~293K)
  emissivity: number; // Thermal infrared emissivity (0.80 to 0.98)
}

export const MATERIAL_PROFILES: Record<string, MaterialSpectralProfile> = {
  red_sample: {
    id: 'red_sample',
    name: 'Object Alpha (Long-Wave Reflective)',
    description: 'Strong reflectance above 600nm and high NIR reflectance',
    approxHex: '#e53935',
    uvReflectance: 0.08,
    nirReflectance: 0.88,
    baseTemperatureKelvin: 294,
    emissivity: 0.92,
    reflectance: [
      0.06, 0.06, 0.06, 0.06, 0.07, 0.07, 0.07, 0.07, 0.08, 0.08,
      0.09, 0.10, 0.11, 0.13, 0.17, 0.25, 0.45, 0.68, 0.82, 0.87,
      0.89, 0.90, 0.90, 0.90, 0.90, 0.91, 0.91, 0.91, 0.91, 0.91, 0.91
    ]
  },
  green_sample: {
    id: 'green_sample',
    name: 'Object Beta (Medium-Wave Reflective)',
    description: 'Peak reflectance around 530nm, moderate UV absorption',
    approxHex: '#43a047',
    uvReflectance: 0.12,
    nirReflectance: 0.65,
    baseTemperatureKelvin: 293,
    emissivity: 0.94,
    reflectance: [
      0.08, 0.08, 0.09, 0.11, 0.14, 0.18, 0.25, 0.38, 0.55, 0.72,
      0.82, 0.85, 0.82, 0.74, 0.60, 0.45, 0.32, 0.22, 0.16, 0.12,
      0.10, 0.09, 0.09, 0.09, 0.09, 0.09, 0.09, 0.09, 0.09, 0.09, 0.09
    ]
  },
  blue_sample: {
    id: 'blue_sample',
    name: 'Object Gamma (Short-Wave Reflective)',
    description: 'Peak reflectance around 440-470nm, strong UV reflectance',
    approxHex: '#1e88e5',
    uvReflectance: 0.78,
    nirReflectance: 0.15,
    baseTemperatureKelvin: 292,
    emissivity: 0.90,
    reflectance: [
      0.35, 0.50, 0.68, 0.82, 0.88, 0.87, 0.82, 0.70, 0.52, 0.35,
      0.22, 0.15, 0.11, 0.09, 0.08, 0.07, 0.07, 0.06, 0.06, 0.06,
      0.06, 0.06, 0.06, 0.06, 0.06, 0.06, 0.06, 0.06, 0.06, 0.06, 0.06
    ]
  },
  yellow_sample: {
    id: 'yellow_sample',
    name: 'Object Delta (Dual Medium+Long Wave Reflective)',
    description: 'High broad reflectance from 530nm to 700nm and NIR',
    approxHex: '#fdd835',
    uvReflectance: 0.06,
    nirReflectance: 0.85,
    baseTemperatureKelvin: 295,
    emissivity: 0.91,
    reflectance: [
      0.05, 0.05, 0.05, 0.06, 0.07, 0.08, 0.10, 0.15, 0.32, 0.58,
      0.78, 0.86, 0.88, 0.89, 0.89, 0.90, 0.90, 0.90, 0.91, 0.91,
      0.91, 0.91, 0.91, 0.91, 0.91, 0.91, 0.91, 0.91, 0.91, 0.91, 0.91
    ]
  },
  white_sample: {
    id: 'white_sample',
    name: 'Object Epsilon (Broad Uniform High Reflectance)',
    description: 'Even high reflectance (~0.88) across all bands including UV and NIR',
    approxHex: '#f5f5f5',
    uvReflectance: 0.85,
    nirReflectance: 0.90,
    baseTemperatureKelvin: 293,
    emissivity: 0.95,
    reflectance: [
      0.86, 0.87, 0.87, 0.88, 0.88, 0.88, 0.88, 0.88, 0.88, 0.88,
      0.89, 0.89, 0.89, 0.89, 0.89, 0.89, 0.89, 0.89, 0.89, 0.89,
      0.89, 0.89, 0.89, 0.89, 0.89, 0.89, 0.89, 0.89, 0.89, 0.89, 0.89
    ]
  },
  wall_concrete: {
    id: 'wall_concrete',
    name: 'Enclosure Wall (Neutral Medium Surface)',
    description: 'Neutral concrete-like reflectance with slight warm mid-tone',
    approxHex: '#d6d3ce',
    uvReflectance: 0.20,
    nirReflectance: 0.68,
    baseTemperatureKelvin: 293,
    emissivity: 0.92,
    reflectance: [
      0.58, 0.59, 0.60, 0.61, 0.62, 0.63, 0.64, 0.64, 0.65, 0.65,
      0.66, 0.66, 0.67, 0.67, 0.68, 0.68, 0.69, 0.69, 0.70, 0.70,
      0.70, 0.70, 0.70, 0.70, 0.70, 0.70, 0.70, 0.70, 0.70, 0.70, 0.70
    ]
  },
  floor_surface: {
    id: 'floor_surface',
    name: 'Enclosure Floor (Dark Neutral Surface)',
    description: 'Even dark slate reflectance ~0.30',
    approxHex: '#4a4e54',
    uvReflectance: 0.15,
    nirReflectance: 0.35,
    baseTemperatureKelvin: 292,
    emissivity: 0.93,
    reflectance: [
      0.28, 0.28, 0.29, 0.29, 0.30, 0.30, 0.30, 0.31, 0.31, 0.31,
      0.32, 0.32, 0.32, 0.32, 0.33, 0.33, 0.33, 0.33, 0.33, 0.33,
      0.33, 0.33, 0.33, 0.33, 0.33, 0.33, 0.33, 0.33, 0.33, 0.33, 0.33
    ]
  },
  ceiling_surface: {
    id: 'ceiling_surface',
    name: 'Enclosure Ceiling',
    description: 'High neutral ceiling reflectance',
    approxHex: '#e8e8e8',
    uvReflectance: 0.35,
    nirReflectance: 0.78,
    baseTemperatureKelvin: 294,
    emissivity: 0.90,
    reflectance: [
      0.75, 0.76, 0.77, 0.78, 0.78, 0.79, 0.79, 0.80, 0.80, 0.80,
      0.81, 0.81, 0.81, 0.82, 0.82, 0.82, 0.82, 0.82, 0.83, 0.83,
      0.83, 0.83, 0.83, 0.83, 0.83, 0.83, 0.83, 0.83, 0.83, 0.83, 0.83
    ]
  },
  torus_magenta: {
    id: 'torus_magenta',
    name: 'Torus Ring (Dual S+L Wave Reflectance)',
    description: 'High reflectance in short (<450nm) and long (>640nm) wavelengths',
    approxHex: '#d81b60',
    uvReflectance: 0.62,
    nirReflectance: 0.75,
    baseTemperatureKelvin: 293,
    emissivity: 0.91,
    reflectance: [
      0.55, 0.62, 0.68, 0.52, 0.32, 0.18, 0.12, 0.08, 0.06, 0.06,
      0.06, 0.07, 0.08, 0.09, 0.12, 0.18, 0.28, 0.46, 0.68, 0.82,
      0.88, 0.90, 0.90, 0.90, 0.90, 0.91, 0.91, 0.91, 0.91, 0.91, 0.91
    ]
  },
  prism_cyan: {
    id: 'prism_cyan',
    name: 'Triangular Prism (Dual S+M Wave Reflectance)',
    description: 'Broad reflectance across 440nm to 540nm and UV fluorescence',
    approxHex: '#00acc1',
    uvReflectance: 0.72,
    nirReflectance: 0.20,
    baseTemperatureKelvin: 293,
    emissivity: 0.89,
    reflectance: [
      0.25, 0.42, 0.62, 0.78, 0.85, 0.86, 0.84, 0.80, 0.75, 0.68,
      0.58, 0.42, 0.26, 0.15, 0.10, 0.08, 0.06, 0.05, 0.05, 0.05,
      0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05
    ]
  },
  hex_amber: {
    id: 'hex_amber',
    name: 'Hexagonal Prism (Medium-Long High Reflectance)',
    description: 'Steep reflectance edge starting at 560nm and high thermal emissivity',
    approxHex: '#fb8c00',
    uvReflectance: 0.04,
    nirReflectance: 0.92,
    baseTemperatureKelvin: 296,
    emissivity: 0.94,
    reflectance: [
      0.05, 0.05, 0.05, 0.05, 0.05, 0.06, 0.06, 0.07, 0.08, 0.12,
      0.18, 0.32, 0.58, 0.78, 0.86, 0.88, 0.89, 0.89, 0.90, 0.90,
      0.90, 0.91, 0.91, 0.91, 0.91, 0.91, 0.91, 0.91, 0.91, 0.91, 0.91
    ]
  },
  star_poly: {
    id: 'star_poly',
    name: 'Star Polyhedron (UV-Fluorescent Violet)',
    description: 'Reflectance peak around 420nm with extraordinary UV reflectance (0.95)',
    approxHex: '#8e24aa',
    uvReflectance: 0.95,
    nirReflectance: 0.40,
    baseTemperatureKelvin: 292,
    emissivity: 0.88,
    reflectance: [
      0.45, 0.65, 0.72, 0.60, 0.38, 0.20, 0.12, 0.08, 0.06, 0.06,
      0.06, 0.07, 0.08, 0.10, 0.12, 0.16, 0.24, 0.38, 0.52, 0.60,
      0.64, 0.65, 0.65, 0.65, 0.65, 0.65, 0.65, 0.65, 0.65, 0.65, 0.65
    ]
  },
  hollow_cup: {
    id: 'hollow_cup',
    name: 'Hollow Vessel (Earthy Ceramic Surface)',
    description: 'Warm ceramic mid-tone reflectance with high heat capacity',
    approxHex: '#a1887f',
    uvReflectance: 0.14,
    nirReflectance: 0.72,
    baseTemperatureKelvin: 294,
    emissivity: 0.95,
    reflectance: [
      0.15, 0.16, 0.18, 0.20, 0.23, 0.26, 0.30, 0.35, 0.40, 0.45,
      0.50, 0.54, 0.58, 0.61, 0.64, 0.66, 0.68, 0.70, 0.72, 0.73,
      0.74, 0.75, 0.75, 0.75, 0.76, 0.76, 0.76, 0.76, 0.76, 0.76, 0.76
    ]
  },
  bracket_alloy: {
    id: 'bracket_alloy',
    name: 'Joint Bracket (Metallic Specular Gray)',
    description: 'Flat broadband specular profile, low thermal emissivity',
    approxHex: '#78909c',
    uvReflectance: 0.55,
    nirReflectance: 0.65,
    baseTemperatureKelvin: 293,
    emissivity: 0.35,
    reflectance: [
      0.60, 0.60, 0.61, 0.61, 0.62, 0.62, 0.62, 0.62, 0.62, 0.62,
      0.62, 0.63, 0.63, 0.63, 0.63, 0.63, 0.63, 0.64, 0.64, 0.64,
      0.64, 0.64, 0.64, 0.64, 0.64, 0.64, 0.64, 0.64, 0.64, 0.64, 0.64
    ]
  }
};

/**
 * Compute the incident spectral radiance arriving at the eye:
 * L(λ) = (I_dir(λ) * cos_theta + I_amb(λ)) * R(λ) / π
 */
export function calculateIncidentRadiance(
  materialReflectance: number[],
  lightSpectrum: number[],
  directShadingFactor: number, // N · L clamped to [0, 1]
  ambientFactor: number = 0.25
): number[] {
  const radiance: number[] = new Array(NUM_BANDS);
  const factor = directShadingFactor * 0.75 + ambientFactor;
  for (let i = 0; i < NUM_BANDS; i++) {
    radiance[i] = materialReflectance[i] * lightSpectrum[i] * factor;
  }
  return radiance;
}

/**
 * Calculate Ultraviolet and Near-Infrared Radiance
 */
export function calculateExtendedRadiance(
  material: MaterialSpectralProfile,
  lightPreset: LightPresetData,
  directShadingFactor: number,
  ambientFactor: number = 0.25
): {
  uvRadiance: number;
  nirRadiance: number;
  thermalKelvin: number;
  thermalRadiance: number;
} {
  const factor = directShadingFactor * 0.75 + ambientFactor;
  const uvRadiance = material.uvReflectance * (lightPreset.uvPower || 0.5) * factor;
  const nirRadiance = material.nirReflectance * (lightPreset.nirPower || 1.0) * factor;

  // Stefan-Boltzmann thermal radiation (normalized to ambient 293K)
  const tempK = material.baseTemperatureKelvin || 293;
  const emissivity = material.emissivity || 0.90;
  // Normalized thermal radiance relative to ambient
  const thermalRadiance = emissivity * Math.pow(tempK / 293, 4);

  return {
    uvRadiance,
    nirRadiance,
    thermalKelvin: tempK,
    thermalRadiance
  };
}

/**
 * Integrate incident spectral radiance L(λ) against S, M, L cone sensitivities
 * Photoreceptor response uses Naka-Rushton hyperbolic compression:
 * V = C / (C + σ), with adaptation parameter σ
 */
export function integrateConeResponses(
  radianceSpectrum: number[],
  adaptationSigma: number = 0.65
): { s: number; m: number; l: number; rawS: number; rawM: number; rawL: number } {
  let rawS = 0;
  let rawM = 0;
  let rawL = 0;

  // Discrete trapezoidal / Riemann integration over 31 bands
  for (let i = 0; i < NUM_BANDS; i++) {
    const L = radianceSpectrum[i];
    rawS += L * S_CONE_SENSITIVITY[i];
    rawM += L * M_CONE_SENSITIVITY[i];
    rawL += L * L_CONE_SENSITIVITY[i];
  }

  // Normalization scale factor
  const normFactor = 0.12;
  const scaledS = rawS * normFactor;
  const scaledM = rawM * normFactor;
  const scaledL = rawL * normFactor;

  // Naka-Rushton compression: models biological photoreceptor adaptation & saturation
  const sAdapted = scaledS / (scaledS + adaptationSigma);
  const mAdapted = scaledM / (scaledM + adaptationSigma);
  const lAdapted = scaledL / (scaledL + adaptationSigma);

  return {
    s: Math.max(0, Math.min(1, sAdapted)),
    m: Math.max(0, Math.min(1, mAdapted)),
    l: Math.max(0, Math.min(1, lAdapted)),
    rawS,
    rawM,
    rawL
  };
}

export interface SevenConeResponse {
  uv: number;
  s: number;
  s2: number;
  m: number;
  m2: number;
  l: number;
  nir: number;
  thermal: number;
  rawUv: number;
  rawS: number;
  rawS2: number;
  rawM: number;
  rawM2: number;
  rawL: number;
  rawNir: number;
}

/**
 * Biological 7-Cone Photoreceptor Integration
 * Computes smooth overlapping integrals across 7 spectral channels:
 * UV, S, S2, M, M2, L, NIR + Thermal Radiance.
 * Applies Naka-Rushton hyperbolic compression for photopic adaptation.
 */
export function integrateSevenConeResponses(
  radianceSpectrum: number[],
  uvRadiance: number,
  nirRadiance: number,
  thermalRadiance: number,
  adaptationSigma: number = 0.65
): SevenConeResponse {
  let rawUv = 0;
  let rawS = 0;
  let rawS2 = 0;
  let rawM = 0;
  let rawM2 = 0;
  let rawL = 0;
  let rawNir = 0;

  for (let i = 0; i < NUM_BANDS; i++) {
    const rad = radianceSpectrum[i] || 0;
    rawUv += rad * UV_CONE_SENSITIVITY[i];
    rawS += rad * S_CONE_SENSITIVITY[i];
    rawS2 += rad * S2_CONE_SENSITIVITY[i];
    rawM += rad * M_CONE_SENSITIVITY[i];
    rawM2 += rad * M2_CONE_SENSITIVITY[i];
    rawL += rad * L_CONE_SENSITIVITY[i];
    rawNir += rad * NIR_CONE_SENSITIVITY[i];
  }

  // Incorporate discrete physical UV and NIR source radiances
  rawUv += uvRadiance * 0.95;
  rawNir += nirRadiance * 0.95;

  const normFactor = 0.12;
  const scaledUv = rawUv * normFactor;
  const scaledS = rawS * normFactor;
  const scaledS2 = rawS2 * normFactor;
  const scaledM = rawM * normFactor;
  const scaledM2 = rawM2 * normFactor;
  const scaledL = rawL * normFactor;
  const scaledNir = rawNir * normFactor;

  // Naka-Rushton adaptation & compression
  const uvAdapted = scaledUv / (scaledUv + adaptationSigma);
  const sAdapted = scaledS / (scaledS + adaptationSigma);
  const s2Adapted = scaledS2 / (scaledS2 + adaptationSigma);
  const mAdapted = scaledM / (scaledM + adaptationSigma);
  const m2Adapted = scaledM2 / (scaledM2 + adaptationSigma);
  const lAdapted = scaledL / (scaledL + adaptationSigma);
  const nirAdapted = scaledNir / (scaledNir + adaptationSigma);
  const thermalAdapted = Math.max(0, Math.min(1, (thermalRadiance - 0.7) / 0.8));

  return {
    uv: Math.max(0, Math.min(1, uvAdapted)),
    s: Math.max(0, Math.min(1, sAdapted)),
    s2: Math.max(0, Math.min(1, s2Adapted)),
    m: Math.max(0, Math.min(1, mAdapted)),
    m2: Math.max(0, Math.min(1, m2Adapted)),
    l: Math.max(0, Math.min(1, lAdapted)),
    nir: Math.max(0, Math.min(1, nirAdapted)),
    thermal: Math.max(0, Math.min(1, thermalAdapted)),
    rawUv,
    rawS,
    rawS2,
    rawM,
    rawM2,
    rawL,
    rawNir,
  };
}

/**
 * Extended Photoreceptor Integration including UV and NIR channels
 */
export function integrateAllPhotoreceptors(
  radianceSpectrum: number[],
  uvRadiance: number,
  nirRadiance: number,
  thermalRadiance: number,
  adaptationSigma: number = 0.65
): {
  s: number;
  m: number;
  l: number;
  uv: number;
  nir: number;
  thermal: number;
} {
  const seven = integrateSevenConeResponses(
    radianceSpectrum,
    uvRadiance,
    nirRadiance,
    thermalRadiance,
    adaptationSigma
  );

  return {
    s: seven.s,
    m: seven.m,
    l: seven.l,
    uv: seven.uv,
    nir: seven.nir,
    thermal: seven.thermal,
  };
}

/**
 * Convert an incident radiance spectrum into standard human sRGB [0..255]
 * strictly for Human Debug View visualization
 */
export function spectrumToHumanRGB(radianceSpectrum: number[]): [number, number, number] {
  // Approximate CIE XYZ integration
  let X = 0, Y = 0, Z = 0;
  for (let i = 0; i < NUM_BANDS; i++) {
    const val = radianceSpectrum[i];
    // x_bar is approx 0.8 * L_cone + 0.2 * S_cone
    const xbar = 0.78 * L_CONE_SENSITIVITY[i] + 0.18 * S_CONE_SENSITIVITY[i];
    const ybar = CIE_Y_BAR[i];
    const zbar = 1.05 * S_CONE_SENSITIVITY[i];

    X += val * xbar;
    Y += val * ybar;
    Z += val * zbar;
  }

  // Scale
  const s = 0.08;
  X *= s;
  Y *= s;
  Z *= s;

  // XYZ to linear sRGB matrix
  const rLin = 3.2406 * X - 1.5372 * Y - 0.4986 * Z;
  const gLin = -0.9689 * X + 1.8758 * Y + 0.0415 * Z;
  const bLin = 0.0557 * X - 0.2040 * Y + 1.0570 * Z;

  // Gamma correction
  const gamma = (c: number) => {
    const clamped = Math.max(0, Math.min(1, c));
    return clamped <= 0.0031308
      ? 12.92 * clamped
      : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
  };

  return [
    Math.round(gamma(rLin) * 255),
    Math.round(gamma(gLin) * 255),
    Math.round(gamma(bLin) * 255)
  ];
}
