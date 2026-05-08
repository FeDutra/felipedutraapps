export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}

export interface Property {
  id: string;
  ownerId?: string;
  name: string;
  location: string;
  latitude?: number;
  longitude?: number;
  city?: string;
  state?: string;
  country?: string;
  altitude?: number;
  description?: string;
  goals?: string[];
  totalArea?: number;
  zones?: string[];
  coordinates?: { lat: number; lng: number };
  createdAt?: Date;
}

export interface Area {
  id: string;
  propertyId?: string;
  name: string;
  type: string;
  description?: string;
  sunExposure?: 'full_sun' | 'partial_shade' | 'full_shade';
  soilType?: string;
  notes?: string;
  photos?: string[];
  image?: string;
  plantsCount?: number;
  size?: number;
  lastActivity?: string;
  status?: string;
  createdAt?: Date;
}

export interface Plant {
  id: string;
  propertyId?: string;
  areaId: string;
  name: string;
  variety: string;
  plantingDate?: Date;
  origin?: 'seed' | 'seedling' | 'cutting' | 'transplant';
  currentStage?: string;
  notes?: string;
  photos?: string[];
  image?: string;
  phase?: string;
  plantedAt?: string;
  status?: string;
  tags?: string[];
  createdAt?: Date;
}

export interface WeatherForecast {
  id: string;
  propertyId: string;
  date: Date;
  source: string;
  temperature: number;
  minTemperature: number;
  maxTemperature: number;
  humidity: number;
  wind: number;
  precipitationProbability: number;
  precipitationMm: number;
  condition: 'sunny' | 'cloudy' | 'rainy' | 'stormy' | 'foggy' | 'clear_night';
  createdAt: Date;
}

export interface WeatherObservation {
  id: string;
  propertyId: string;
  date: Date;
  observedCondition: string;
  notes: string;
  photos: string[];
  createdAt: Date;
}

export interface RainLog {
  id?: string;
  date: string;
  reality: number;
  forecast: number;
  intensity?: string;
  notes?: string;
  createdAt?: Date;
}

export interface MoonPhase {
  id: string;
  date: Date;
  phase: 'new' | 'waxing_crescent' | 'first_quarter' | 'waxing_gibbous' | 'full' | 'waning_gibbous' | 'last_quarter' | 'waning_crescent';
  illumination: number;
  moonrise: string;
  moonset: string;
  distance: string;
  nextFullMoon: Date;
  nextNewMoon: Date;
}

export interface EventBase {
  id: string;
  type: 'chuva' | 'plantio' | 'poda' | 'irrigacao' | 'colheita' | 'praga' | 'foto' | 'obs';
  propertyId: string;
  userId: string;
  notes?: string;
  photos?: string[];
  createdAt: Date;
  weatherSnapshot?: Partial<WeatherData>;
  moonSnapshot?: Partial<LunarData>;
}

export interface RainEvent extends EventBase {
  type: 'chuva';
  intensity: 'garoa' | 'chuva_fraca' | 'moderada' | 'forte' | 'temporal';
  duration: 'minutos' | 'menos_1h' | 'algumas_horas' | 'madrugada' | 'dia_todo';
  mm?: number;
  impact: 'solo_umido' | 'solo_encharcado' | 'escorreu_agua' | 'sem_impacto';
  affectedAreas?: string[];
}

export interface PlantingEvent extends EventBase {
  type: 'plantio';
  culture: string;
  variety: string;
  areaId: string;
  origin: 'semente' | 'muda' | 'estaquia' | 'transplante';
  quantity: number;
}

export interface PruningEvent extends EventBase {
  type: 'poda';
  plantId: string;
  areaId: string;
  pruningType: 'limpeza' | 'formacao' | 'conducao' | 'frutificacao' | 'contencao' | 'doenca';
  intensity: 'leve' | 'moderada' | 'forte';
  reason: string;
}

export interface IrrigationEvent extends EventBase {
  type: 'irrigacao';
  target: { type: 'area' | 'plant', id: string };
  method: 'manual' | 'regador' | 'mangueira' | 'gotejamento' | 'aspersao';
  durationMinutes: number;
  soilBefore: 'seco' | 'leve_umido' | 'umido' | 'encharcado';
}

export interface HarvestEvent extends EventBase {
  type: 'colheita';
  culture: string;
  areaId: string;
  quantity: number;
  unit: 'unidade' | 'kg' | 'maco' | 'cesto' | 'punhado';
  quality: 'boa' | 'media' | 'baixa' | 'perda';
  destination: 'consumo' | 'doacao' | 'venda' | 'semente' | 'compostagem';
}

export interface PestObservationEvent extends EventBase {
  type: 'praga';
  plantId: string;
  areaId: string;
  affectedPart: 'folha' | 'caule' | 'fruto' | 'flor' | 'raiz' | 'solo';
  signs: string[]; // ['inseto', 'ovo', 'mancha', etc]
  intensity: 'pouco' | 'moderado' | 'muito' | 'espalhando';
  aiAnalysisRequested: boolean;
}

export interface PhotoEvent extends EventBase {
  type: 'foto';
  linkedTo: { type: 'property' | 'area' | 'plant' | 'event', id: string };
  analyzeWithAi: boolean;
  compareWithPrevious: boolean;
}

export interface GeneralObservationEvent extends EventBase {
  type: 'obs';
  observationType: 'solo' | 'clima' | 'planta' | 'animal' | 'estrutura' | 'area' | 'geral';
  linkedTo?: { type: 'area' | 'plant', id: string };
}

export type PropertyEvent = 
  | RainEvent 
  | PlantingEvent 
  | PruningEvent 
  | IrrigationEvent 
  | HarvestEvent 
  | PestObservationEvent 
  | PhotoEvent 
  | GeneralObservationEvent;

export interface Event extends EventBase {
  areaId?: string;
  plantId?: string;
  title: string;
}

export interface AiAnalysis {
  id: string;
  propertyId: string;
  areaId?: string;
  plantId?: string;
  eventId?: string;
  prompt: string;
  response: string;
  photos: string[];
  confidence: number;
  createdAt: Date;
}

export interface Report {
  id: string;
  propertyId: string;
  type: 'daily' | 'weekly' | 'monthly' | 'yearly';
  period: string;
  summary: string;
  highlights: string[];
  createdAt: Date;
}

export interface LunarData {
  phase: string;
  moonPhase: number; // 0 to 1, Google Weather API standard
  illumination: number;
  moonrise: string;
  moonset: string;
  distance: string;
  nextFullMoon: string;
  agriculturalImpact: string;
  visibility: number;
}

export interface WeatherData {
  temp: number;
  condition: 'sunny' | 'cloudy' | 'rainy' | 'stormy' | 'foggy' | 'clear_night';
  humidity: number;
  windSpeed: number;
  rainProbability: number;
  feelsLike: number;
  uvIndex: number;
  sunrise: string;
  sunset: string;
}

export interface HomeSummary {
  property: Property;
  weather: WeatherData;
  rainComparison: {
    registered: number;
    forecast: number;
    status: 'above' | 'pending' | 'mismatch';
    message: string;
  };
  moon: LunarData;
  sunlight: {
    sunrise: string;
    sunset: string;
    uvIndex: number;
    risk: string;
    daylightProgress: number;
  };
  humidity: {
    percentage: number;
    dewPoint: string;
  };
  wind: {
    speed: number;
    gusts: string;
  };
  landSummary: {
    plantsCount: number;
    areasCount: number;
    lastActivity: string;
    alert?: string;
  };
  dailySuggestion: string;
}
