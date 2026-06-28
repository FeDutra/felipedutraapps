import { BaseProperties, getInitialProps } from './semioticGrammar';

interface CompoundDefinition {
  name: string;
  props: Partial<BaseProperties>;
}

// Maps sorted, hyphen-separated element labels to compounds
const COMPOUNDS: Record<string, CompoundDefinition> = {
  'alegria-luminoso': {
    name: 'expansão radiante',
    props: { joy: 1.0, expansion: 0.8, warmth: 0.5 }
  },
  'alegria-sombrio': {
    name: 'brilho ferido',
    props: { joy: 0.6, sadness: 0.5, coldness: 0.3 }
  },
  'etéreo-melancólico': {
    name: 'saudade fantasmática',
    props: { melancholic: 1.0, etéreo: 0.9, ghostTrails: 0.8, delayTime: 0.8, delayFeedback: 0.6 }
  },
  'colérico-denso': {
    name: 'pressão explosiva',
    props: { choleric: 1.0, density: 0.9, glitchIntensity: 0.8, detune: 15 }
  },
  'medo-translúcido': {
    name: 'presença instável e vulnerável',
    props: { fear: 0.9, transparency: 0.9, liquidWarp: 0.5, delayTime: 0.7 }
  },
  'bruto-sagrado': {
    name: 'rito arcaico',
    props: { sagrado: 0.9, roughness: 0.9, halftoneIntensity: 0.6 }
  },
  'erótico-frio': {
    name: 'desejo distante',
    props: { erotico: 0.8, coldness: 0.8 }
  },
  'infantil-ruína': {
    name: 'memória quebrada',
    props: { infantil: 0.8, sadness: 0.8, halftoneIntensity: 0.6 }
  },
  'áspero-colérico': {
    name: 'agressão seca',
    props: { choleric: 0.9, roughness: 0.9, glitchIntensity: 0.8, halftoneIntensity: 0.7, detune: 18 }
  },
  'colérico-vermelho': {
    name: 'explosão quente',
    props: { choleric: 1.0, colorRed: 1.0, warmth: 0.9, glitchIntensity: 0.85 }
  },
  'colérico-fogo': {
    name: 'combustão ativa',
    props: { choleric: 1.0, warmth: 1.0, chromaticAberration: 0.9 }
  },
  'tristeza-água': {
    name: 'corrente lenta / escorrimento',
    props: { sadness: 0.8, coldness: 0.6, liquidWarp: 0.8, pixelSort: 0.5, delayTime: 0.8, delayFeedback: 0.6 }
  },
  'alegria-água': {
    name: 'cintilação líquida / cintilação',
    props: { joy: 0.8, liquidWarp: 0.8, jitter: 0.6 }
  },
  'raiva-fogo': {
    name: 'explosão / ruptura',
    props: { anger: 1.0, warmth: 0.9, glitchIntensity: 0.9, threshold: 0.7 }
  },
  'ritual-fogo': {
    name: 'chama circular',
    props: { ritual: 0.9, warmth: 0.8, ritualShapes: 0.8, delayTime: 0.4 }
  },
  'ar-etéreo': {
    name: 'suspensão / névoa',
    props: { etéreo: 1.0, transparency: 0.9, delayTime: 0.9, ghostTrails: 0.7 }
  },
  'medo-ar': {
    name: 'vazio inquieto / instabilidade vazia',
    props: { fear: 0.9, transparency: 0.8, jitter: 0.8, ghostTrails: 0.5 }
  },
  'terra-terroso': {
    name: 'chão / solo',
    props: { density: 1.0, roughness: 0.8, halftoneIntensity: 0.6 }
  },
  'terra-melancólico': {
    name: 'peso antigo / peso',
    props: { density: 0.9, melancholic: 0.9, delayTime: 0.7, delayFeedback: 0.5 }
  },
  'colérico-pedra': {
    name: 'impacto',
    props: { choleric: 0.9, density: 0.8, detune: 10, glitchIntensity: 0.6 }
  },
  'ritual-pedra': {
    name: 'monólito',
    props: { ritual: 1.0, density: 1.0, ritualShapes: 0.7 }
  },
  'barro-erótico': {
    name: 'corpo úmido',
    props: { density: 0.8, erotico: 0.8, liquidWarp: 0.6 }
  },
  'barro-terra': {
    name: 'massa pesada / massa',
    props: { density: 1.0, roughness: 0.7 }
  },
  'névoa-melancólico': {
    name: 'saudade',
    props: { etéreo: 0.8, melancholic: 0.8, ghostTrails: 0.8, delayTime: 0.8 }
  },
  'névoa-translúcido': {
    name: 'fantasma',
    props: { transparency: 0.9, etéreo: 0.8, ghostTrails: 0.9 }
  },
  'metal-colérico': {
    name: 'impacto metálico / risco metálico',
    props: { choleric: 0.9, detune: 15, resonance: 0.9, chromaticAberration: 0.7 }
  },
  'lisa-fleumático': {
    name: 'calma extrema / acalma',
    props: { softness: 0.9, phlegmatic: 0.9, attack: 1.5, delayTime: 0.8 }
  },
  'lisa-branco': {
    name: 'suavidade / limpa',
    props: { softness: 1.0, transparency: 0.9, attack: 1.0 }
  },
  'áspero-vermelho': {
    name: 'abrasão quente / seca a imagem',
    props: { roughness: 0.9, colorRed: 1.0, warmth: 0.8, halftoneIntensity: 0.8 }
  },
  'porosa-água': {
    name: 'esponja sonora / esponja',
    props: { roughness: 0.5, liquidWarp: 0.5, halftoneIntensity: 0.6 }
  },
  'porosa-medo': {
    name: 'fragilidade',
    props: { fear: 0.8, roughness: 0.6, jitter: 0.5 }
  },
  'rachada-tristeza': {
    name: 'voz quebrada / vidro trincado',
    props: { sadness: 0.8, roughness: 0.8, glitchIntensity: 0.6 }
  },
  'rachada-raiva': {
    name: 'estalo / ruptura',
    props: { anger: 0.8, roughness: 0.9, glitchIntensity: 0.8 }
  },
  'aveludada-erótico': {
    name: 'proximidade',
    props: { softness: 0.9, erotico: 0.9, warmth: 0.5 }
  },
  'aveludada-satisfação': {
    name: 'repouso',
    props: { softness: 0.9, joy: 0.7, attack: 1.2 }
  },
  'sanguíneo-alegria': {
    name: 'festa / vibração',
    props: { sanguine: 0.9, joy: 0.9, jitter: 0.7, spatiality: 0.5 }
  },
  'fleumático-água': {
    name: 'lago',
    props: { phlegmatic: 0.9, liquidWarp: 0.7, delayTime: 0.8 }
  },
  'fleumático-liso': {
    name: 'silêncio macio / silêncio',
    props: { phlegmatic: 0.9, softness: 0.9, attack: 1.8 }
  },
  'denso-terra': {
    name: 'chão / bloco',
    props: { density: 1.0, roughness: 0.7 }
  },
  'sagrado-dourado': {
    name: 'altar',
    props: { sagrado: 1.0, colorGold: 1.0, warmth: 0.6, resonance: 0.8 }
  },
  'sagrado-preto': {
    name: 'silêncio sagrado / templo escuro',
    props: { sagrado: 1.0, density: 0.8, delayTime: 0.9 }
  },
  'erótico-úmido': {
    name: 'desejo material / adere',
    props: { erotico: 0.9, liquidWarp: 0.8 }
  },
  'etéreo-violeta': {
    name: 'sonho',
    props: { etéreo: 0.9, colorBlue: 0.5, colorRed: 0.4, ghostTrails: 0.7 }
  },
  'elevação-sagrado': {
    name: 'ascensão / ascende',
    props: { elevation: 0.9, sagrado: 0.9, delayTime: 0.8 }
  },
  'descida-terra': {
    name: 'aterramento / aterra',
    props: { descent: 0.9, density: 0.9, decay: 1.5 }
  },
  'descida-culpa': {
    name: 'queda / afunda',
    props: { descent: 0.9, sadness: 0.8, decay: 2.0 }
  },
  'fricção-raiva': {
    name: 'tensão agressiva / corta',
    props: { friction: 0.9, anger: 0.9, detune: 20 }
  },
  'fricção-metal': {
    name: 'serrilha / risca',
    props: { friction: 0.9, detune: 15, resonance: 0.8 }
  },
  'ruptura-rachada': {
    name: 'falha / estilhaça',
    props: { roughness: 0.9, glitchIntensity: 0.9, threshold: 0.8 }
  },
  'ruptura-revolta': {
    name: 'estilhaço / rasga',
    props: { anger: 0.9, glitchIntensity: 1.0, pixelSort: 0.8 }
  },
  'ressonância-afinidade': {
    name: 'consonância / sincroniza',
    props: { ressonancia: 0.9, afinidade: 0.9, delayTime: 0.6 }
  },
  'eco-nostalgia': {
    name: 'lembrança',
    props: { eco: 0.9, sadness: 0.6, delayFeedback: 0.7 }
  },
  'eco-espaço': {
    name: 'caverna / distancia',
    props: { eco: 0.9, delayFeedback: 0.8, spatiality: 0.8 }
  },
  'contraste-medo': {
    name: 'desconforto',
    props: { contraste: 0.9, fear: 0.8, threshold: 0.6 }
  },
  'contraste-criação': {
    name: 'tensão estética / compõe',
    props: { contraste: 0.9, criativa: 0.9, threshold: 0.5 }
  },
  'continuidade-volume': {
    name: 'fluxo',
    props: { continuidade: 0.9, delayTime: 0.7 }
  },
  'atravessamento-raiva': {
    name: 'invasão',
    props: { atravessamento: 0.9, anger: 0.8, glitchIntensity: 0.7 }
  },
  'jardim-planta': {
    name: 'ecossistema',
    props: { jardim: 0.9, joy: 0.5 }
  },
  'jardim-satisfação': {
    name: 'jardim repousado / paisagem cuidada',
    props: { jardim: 0.9, joy: 0.7 }
  }
};

export function getCompoundProps(labelA: string, labelB: string): BaseProperties | null {
  const normA = labelA.toLowerCase().trim();
  const normB = labelB.toLowerCase().trim();
  
  const key1 = `${normA}-${normB}`;
  const key2 = `${normB}-${normA}`;
  
  const found = COMPOUNDS[key1] || COMPOUNDS[key2] || null;
  if (!found) return null;
  
  const merged = getInitialProps();
  Object.assign(merged, found.props);
  return merged;
}
