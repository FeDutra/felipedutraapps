import { Property, Area, Plant, RainLog, LunarData, WeatherData } from '@/shared/types';

export const mockProperty: Property = {
  id: 'prop-1',
  name: 'Sítio Recanto Feliz',
  location: 'São Lourenço da Serra, SP',
  coordinates: { lat: -23.8542, lng: -46.9431 },
  totalArea: 15.5,
  zones: ['Horta', 'Pomar', 'Reserva', 'Produção']
};

export const mockAreas: Area[] = [
  {
    id: 'area-1',
    name: 'Horta Principal',
    type: 'Horta',
    size: 250,
    status: 'active',
    image: 'https://images.unsplash.com/photo-1523348837708-15d4a09cfac2?auto=format&fit=crop&q=80&w=800',
    plantsCount: 12,
    lastActivity: 'Irrigação há 2h'
  },
  {
    id: 'area-2',
    name: 'Pomar Sul',
    type: 'Pomar',
    size: 1500,
    status: 'active',
    image: 'https://images.unsplash.com/photo-1464683001143-50326214358b?auto=format&fit=crop&q=80&w=800',
    plantsCount: 45,
    lastActivity: 'Poda há 3 dias'
  },
  {
    id: 'area-3',
    name: 'Canteiro de Ervas',
    type: 'Horta',
    size: 50,
    status: 'active',
    image: 'https://images.unsplash.com/photo-1591857177580-dc82b9ac4e1e?auto=format&fit=crop&q=80&w=800',
    plantsCount: 8,
    lastActivity: 'Plantio hoje'
  }
];

export const mockPlants: Plant[] = [
  {
    id: 'plant-1',
    name: 'Tomate Cereja',
    variety: 'Sweet Heaven',
    areaId: 'area-1',
    status: 'healthy',
    phase: 'Frutificação',
    plantedAt: '2024-03-14',
    image: 'https://images.unsplash.com/photo-1592841200221-a6898f307baa?auto=format&fit=crop&q=80&w=400',
    tags: ['Horta', 'Orgânico']
  },
  {
    id: 'plant-2',
    name: 'Pessegueiro',
    variety: 'Aurora',
    areaId: 'area-2',
    status: 'dormant',
    phase: 'Dormência',
    plantedAt: '2023-08-19',
    image: 'https://images.unsplash.com/photo-1595123550441-d377e017de6a?auto=format&fit=crop&q=80&w=400',
    tags: ['Pomar', 'Fruta']
  },
  {
    id: 'plant-3',
    name: 'Manjericão',
    variety: 'Genovês',
    areaId: 'area-3',
    status: 'healthy',
    phase: 'Crescimento',
    plantedAt: '2024-04-10',
    image: 'https://images.unsplash.com/photo-1618376139627-3074463fd51f?auto=format&fit=crop&q=80&w=400',
    tags: ['Ervas', 'Tempero']
  },
  {
    id: 'plant-4',
    name: 'Abacateiro',
    variety: 'Breda',
    areaId: 'area-2',
    status: 'warning',
    phase: 'Crescimento',
    plantedAt: '2022-11-05',
    image: 'https://images.unsplash.com/photo-1559181567-c3190ca9959b?auto=format&fit=crop&q=80&w=400',
    tags: ['Pomar', 'Madeira']
  }
];

export const mockRainLogs: RainLog[] = [
  { date: '01/05', reality: 12, forecast: 8 },
  { date: '02/05', reality: 5, forecast: 15 },
  { date: '03/05', reality: 0, forecast: 2 },
  { date: '04/05', reality: 18, forecast: 10 },
  { date: '05/05', reality: 25, forecast: 20 },
  { date: '06/05', reality: 8, forecast: 5 },
  { date: '07/05', reality: 0, forecast: 0 }
];

export const mockLunar: LunarData = {
  phase: 'Crescente',
  moonPhase: 0.65,
  illumination: 65,
  moonrise: '10:45',
  moonset: '23:12',
  distance: '384.400 km',
  nextFullMoon: '2024-05-23',
  agriculturalImpact: 'Favorável para plantio de hortaliças de folhas e flores.',
  visibility: 85
};

export const mockWeather: WeatherData = {
  temp: 24,
  condition: 'sunny',
  humidity: 62,
  windSpeed: 12,
  rainProbability: 10,
  feelsLike: 26,
  uvIndex: 6,
  sunrise: '06:15',
  sunset: '18:02'
};

export const mockHomeSummary: import('@/shared/types').HomeSummary = {
  property: mockProperty,
  weather: mockWeather,
  rainComparison: {
    registered: 12,
    forecast: 8,
    status: 'above',
    message: 'Choveu 4mm acima do previsto.'
  },
  moon: mockLunar,
  sunlight: {
    sunrise: '06:15',
    sunset: '18:02',
    uvIndex: 6,
    risk: 'Risco Moderado',
    daylightProgress: 65
  },
  humidity: {
    percentage: 62,
    dewPoint: '16° agora'
  },
  wind: {
    speed: 12,
    gusts: '18 km/h'
  },
  landSummary: {
    plantsCount: 4,
    areasCount: 3,
    lastActivity: 'irrigação há 2h',
    alert: '1 planta sem registro há 12 dias'
  },
  dailySuggestion: 'Com sol forte e solo úmido, observe mudas novas no fim da tarde.'
};

// Alternative Rain States for testing
export const rainStates = {
  A: { registered: 12, forecast: 8, status: 'above', message: 'Choveu 4mm acima do previsto.' },
  B: { registered: 0, forecast: 8, status: 'pending', message: 'Ainda não há registro real de chuva hoje.' },
  C: { registered: 0, forecast: 8, status: 'mismatch', message: 'A previsão indicava chuva, mas ainda não choveu na propriedade.' }
};
