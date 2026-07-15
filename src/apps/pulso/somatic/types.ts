export interface LotusSignal {
  // Voice input
  audioInputIntensity: number;
  audioOutputIntensity: number;
  
  // User interaction
  mouseProximity: number; // 0 to 1
  mouseDx: number; // relative distance in X
  mouseDy: number; // relative distance in Y
  typingSpeed: number; // characters typed recently
  isTyping: boolean;
  
  // UI triggers
  panelOpenLeft: boolean;
  panelOpenRight: boolean;
  boxOpen: boolean;
}

export interface LotusSomaticState {
  // Emotional Eixes (0 to 1)
  energia: number;
  tensao: number;
  abertura: number;
  acolhimento: number;
  certeza: number;
  coerencia: number;
  gravidade: number;
  curiosidade: number;
  
  // Attentional Eixes (-1 to 1)
  attentionX: number;
  attentionY: number;
}

export interface LotusClimate {
  temperature: number; // Celsius
  timeOfDay: 'day' | 'night';
  weather: 'clear' | 'rain';
  silenceDuration: number;
  conversationLength: number;
  systemActivity: number;
  deepFocus: boolean;
}

export interface LotusPhysicalParams {
  // Constants
  borderWidth: number; // fixed at 19px
  
  // Geometry Modifiers computed by engine
  scale: number;
  ovalnessX: number;
  ovalnessY: number;
  tension: number;
  asymmetry: number;
  wavePhase: number;
  waveAmplitude: number;
  waveFrequency: number;
  centerShiftX: number;
  centerShiftY: number;
  
  // Appearance
  opacity: number;
  glow: number;
  speed: number;
  colorTemp: string;
}
