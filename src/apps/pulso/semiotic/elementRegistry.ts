import { BaseProperties, getInitialProps } from './semioticGrammar';

export function getBaseProps(type: string, label: string): BaseProperties {
  const props = getInitialProps();
  if (!label || typeof label !== 'string') return props;
  const lowerLabel = label.toLowerCase();

  // 1. CORES
  if (type === 'cor') {
    if (lowerLabel === 'vermelho') {
      props.colorRed = 1.0; props.warmth = 0.8; props.anger = 0.4;
      props.chromaticAberration = 0.6;
    }
    else if (lowerLabel === 'vinho') {
      props.colorRed = 0.7; props.colorBlue = 0.3; props.warmth = 0.5; props.sadness = 0.3;
      props.delayTime = 0.6; props.delayFeedback = 0.35;
    }
    else if (lowerLabel === 'ferrugem') {
      props.colorGold = 0.5; props.colorRed = 0.5; props.warmth = 0.4; props.roughness = 0.6;
      props.halftoneIntensity = 0.35;
    }
    else if (lowerLabel === 'rosa') {
      props.colorRed = 0.6; props.joy = 0.5; props.softness = 0.7;
      props.attack = 0.4;
    }
    else if (lowerLabel === 'âmbar') {
      props.colorGold = 0.8; props.warmth = 0.6; props.joy = 0.4;
    }
    else if (lowerLabel === 'dourado') {
      props.colorGold = 1.0; props.warmth = 0.7; props.joy = 0.6;
    }
    else if (lowerLabel === 'azul') {
      props.colorBlue = 1.0; props.coldness = 0.8; props.sadness = 0.5;
    }
    else if (lowerLabel === 'verde') {
      props.colorBlue = 0.4; props.colorGold = 0.5; props.joy = 0.3;
    }
    else if (lowerLabel === 'preto') {
      props.density = 0.8; props.sadness = 0.6; props.coldness = 0.3;
    }
    else if (lowerLabel === 'branco') {
      props.transparency = 0.8; props.joy = 0.5; props.coldness = 0.2;
    }
    else if (lowerLabel === 'cinza') {
      props.coldness = 0.4; props.sadness = 0.4;
    }
    else if (lowerLabel === 'violeta') {
      props.colorBlue = 0.6; props.colorRed = 0.4; props.etéreo = 0.7;
    }
    else if (lowerLabel === 'esmeralda') {
      props.colorBlue = 0.3; props.colorGold = 0.7; props.joy = 0.5;
    }
    else if (lowerLabel === 'turquesa') {
      props.colorBlue = 0.8; props.colorGold = 0.2; props.coldness = 0.5;
    }
    else if (lowerLabel === 'cobre') {
      props.colorGold = 0.6; props.colorRed = 0.4; props.warmth = 0.5; props.roughness = 0.4;
      props.halftoneIntensity = 0.25;
    }
    else if (lowerLabel === 'prata') {
      props.colorBlue = 0.4; props.coldness = 0.6; props.transparency = 0.5;
    }
    else if (lowerLabel === 'bronze') {
      props.colorGold = 0.5; props.colorRed = 0.5; props.roughness = 0.5;
      props.halftoneIntensity = 0.3;
    }
    else if (lowerLabel === 'ocre') {
      props.colorGold = 0.6; props.density = 0.4;
    }
    else if (lowerLabel === 'mostarda') {
      props.colorGold = 0.8; props.warmth = 0.4;
    }
    else if (lowerLabel === 'índigo') {
      props.colorBlue = 0.9; props.sadness = 0.4;
    }
    else if (lowerLabel === 'carvão') {
      props.density = 0.9; props.roughness = 0.7;
      props.halftoneIntensity = 0.4;
    }
  }
  // 2. ELEMENTOS
  else if (type === 'elementos') {
    if (lowerLabel === 'água') {
      props.coldness = 0.6; props.softness = 0.8; props.colorBlue = 0.5;
      props.liquidWarp = 0.6;
    }
    else if (lowerLabel === 'fogo') {
      props.warmth = 1.0; props.expansion = 0.6; props.colorRed = 0.8;
      props.chromaticAberration = 0.8;
    }
    else if (lowerLabel === 'ar') {
      props.etéreo = 0.9; props.expansion = 0.7; props.transparency = 0.8;
      props.delayTime = 0.5; props.delayFeedback = 0.4;
    }
    else if (lowerLabel === 'terra') {
      props.density = 1.0; props.roughness = 0.6;
      props.halftoneIntensity = 0.5;
    }
  }
  // 3. NATUREZA
  else if (type === 'natureza') {
    if (lowerLabel === 'pedra') {
      props.density = 0.9; props.roughness = 0.8;
      props.halftoneIntensity = 0.6;
    }
    else if (lowerLabel === 'barro') {
      props.density = 0.7; props.warmth = 0.2;
    }
    else if (lowerLabel === 'fumaça') {
      props.etéreo = 0.8; props.expansion = 0.5;
    }
    else if (lowerLabel === 'planta') {
      props.joy = 0.4; props.softness = 0.5;
    }
    else if (lowerLabel === 'metal') {
      props.density = 0.9; props.coldness = 0.6;
      props.detune = 8;
    }
    else if (lowerLabel === 'névoa') {
      props.etéreo = 0.9; props.coldness = 0.4; props.transparency = 0.6;
      props.ghostTrails = 0.4;
    }
    else if (lowerLabel === 'poeira') {
      props.roughness = 0.5;
      props.halftoneIntensity = 0.3;
    }
    else if (lowerLabel === 'sal') {
      props.roughness = 0.7;
      props.halftoneIntensity = 0.4;
    }
    else if (lowerLabel === 'sangue') {
      props.warmth = 0.6; props.colorRed = 1.0;
      props.chromaticAberration = 0.4;
    }
    else if (lowerLabel === 'ruína') {
      props.sadness = 0.6; props.roughness = 0.8;
      props.halftoneIntensity = 0.5;
    }
  }
  // 4. TEXTURAS
  else if (type === 'textura') {
    if (lowerLabel === 'lisa') {
      props.softness = 1.0;
      props.attack = 1.2;
    }
    else if (lowerLabel === 'áspera') {
      props.roughness = 1.0;
      props.halftoneIntensity = 0.7;
    }
    else if (lowerLabel === 'porosa') {
      props.roughness = 0.6; props.transparency = 0.3;
      props.halftoneIntensity = 0.4;
    }
    else if (lowerLabel === 'fibrosa') {
      props.roughness = 0.5;
    }
    else if (lowerLabel === 'rachada') {
      props.roughness = 0.9;
      props.glitchIntensity = 0.4;
    }
    else if (lowerLabel === 'aveludada') {
      props.softness = 0.9; props.warmth = 0.3;
      props.attack = 0.8;
    }
    else if (lowerLabel === 'granulada') {
      props.roughness = 0.7;
      props.halftoneIntensity = 0.6;
    }
    else if (lowerLabel === 'úmida') {
      props.softness = 0.5; props.coldness = 0.1;
    }
    else if (lowerLabel === 'seca') {
      props.roughness = 0.4;
    }
    else if (lowerLabel === 'enrugada') {
      props.roughness = 0.6;
    }
    else if (lowerLabel === 'estriada') {
      props.roughness = 0.4;
    }
    else if (lowerLabel === 'escamosa') {
      props.roughness = 0.7;
    }
    else if (lowerLabel === 'espinhosa') {
      props.roughness = 0.9; props.anger = 0.4;
      props.glitchIntensity = 0.35;
    }
    else if (lowerLabel === 'pegajosa') {
      props.density = 0.6;
    }
    else if (lowerLabel === 'gelada') {
      props.coldness = 1.0;
    }
    else if (lowerLabel === 'cristalina') {
      props.transparency = 0.9; props.coldness = 0.4;
    }
  }
  // 5. TEMPERAMENTOS
  else if (type === 'temperamentos') {
    if (lowerLabel === 'sanguíneo') {
      props.sanguine = 1.0; props.joy = 0.5; props.expansion = 0.5;
    }
    else if (lowerLabel === 'colérico') {
      props.choleric = 1.0; props.anger = 0.6; props.expansion = 0.6;
      props.glitchIntensity = 0.75;
      props.detune = 12;
    }
    else if (lowerLabel === 'melancólico') {
      props.melancholic = 1.0; props.sadness = 0.6; props.contraction = 0.6;
      props.delayTime = 0.7; props.delayFeedback = 0.5;
    }
    else if (lowerLabel === 'fleumático') {
      props.phlegmatic = 1.0; props.softness = 0.5; props.contraction = 0.2;
      props.attack = 1.0;
    }
  }
  // 6. ATRIBUTOS
  else if (type === 'atributo') {
    if (lowerLabel === 'quente') { props.warmth = 1.0; }
    else if (lowerLabel === 'frio') { props.coldness = 1.0; }
    else if (lowerLabel === 'seco') { props.roughness = 0.5; }
    else if (lowerLabel === 'úmido') { props.softness = 0.5; }
    else if (lowerLabel === 'áspero') {
      props.roughness = 1.0;
      props.halftoneIntensity = 0.7;
    }
    else if (lowerLabel === 'liso') {
      props.softness = 1.0;
      props.attack = 1.2;
    }
    else if (lowerLabel === 'denso') { props.density = 1.0; }
    else if (lowerLabel === 'rarefeito') {
      props.etéreo = 1.0;
      props.delayTime = 0.6; props.delayFeedback = 0.4;
    }
    else if (lowerLabel === 'opaco') { props.density = 0.8; }
    else if (lowerLabel === 'translúcido') { props.transparency = 1.0; }
    else if (lowerLabel === 'sagrado') {
      props.sagrado = 1.0;
      props.delayTime = 0.55; props.delayFeedback = 0.6;
    }
    else if (lowerLabel === 'erótico') { props.erotico = 1.0; }
    else if (lowerLabel === 'infantil') { props.infantil = 1.0; }
    else if (lowerLabel === 'terroso') { props.density = 0.7; props.roughness = 0.5; }
    else if (lowerLabel === 'etéreo') {
      props.etéreo = 1.0;
      props.delayTime = 0.5; props.delayFeedback = 0.5;
    }
    else if (lowerLabel === 'delicado') { props.softness = 0.8; }
    else if (lowerLabel === 'bruto') { props.roughness = 0.9; props.density = 0.8; }
    else if (lowerLabel === 'ritual') { props.sagrado = 0.8; }
    else if (lowerLabel === 'sombrio') { props.sadness = 0.5; props.density = 0.6; }
    else if (lowerLabel === 'luminoso') { props.joy = 0.6; props.transparency = 0.5; }
  }
  // 7. FORÇAS
  else if (type === 'forca') {
    if (lowerLabel === 'expansão') {
      props.expansion = 1.0;
      props.delayFeedback = 0.4;
    }
    else if (lowerLabel === 'contração') { props.contraction = 1.0; }
    else if (lowerLabel === 'elevação') { props.elevation = 1.0; }
    else if (lowerLabel === 'descida') { props.descent = 1.0; }
    else if (lowerLabel === 'dissolução') {
      props.etéreo = 0.8;
      props.delayTime = 0.4;
    }
    else if (lowerLabel === 'condensação') { props.density = 0.8; }
    else if (lowerLabel === 'fricção') {
      props.friction = 1.0;
      props.detune = 15;
      props.glitchIntensity = 0.45;
    }
    else if (lowerLabel === 'fusão') { props.softness = 0.5; }
    else if (lowerLabel === 'ruptura') {
      props.roughness = 0.7; props.friction = 0.5;
      props.glitchIntensity = 0.5;
    }
    else if (lowerLabel === 'sustentação') { props.density = 0.6; }
    else if (lowerLabel === 'germinação') { props.joy = 0.4; }
    else if (lowerLabel === 'combustão') {
      props.warmth = 0.8; props.expansion = 0.8;
      props.chromaticAberration = 0.5;
    }
  }
  // 8. RELAÇÕES
  else if (type === 'relacao') {
    if (lowerLabel === 'eco') {
      props.eco = 1.0;
      props.ghostTrails = 0.8;
      props.delayTime = 0.5; props.delayFeedback = 0.6;
    }
    else if (lowerLabel === 'fricção') {
      props.friction = 1.0;
      props.detune = 15;
      props.glitchIntensity = 0.45;
    }
    else if (lowerLabel === 'ressonância') {
      props.ressonancia = 1.0;
      props.resonance = 12.0;
      props.sustain = 0.8;
    }
    else if (lowerLabel === 'afinidade') { props.afinidade = 1.0; }
    else if (lowerLabel === 'contraste') {
      props.contraste = 1.0;
      props.detune = 20;
    }
    else if (lowerLabel === 'continuidade') {
      props.continuidade = 1.0;
      props.delayFeedback = 0.4;
    }
    else if (lowerLabel === 'atravessamento') {
      props.atravessamento = 1.0;
      props.glitchIntensity = 0.6;
    }
  }
  // 9. ENCARNAÇÕES
  else if (type === 'encarnacao') {
    if (lowerLabel === 'jardim') { props.jardim = 1.0; }
    else if (lowerLabel === 'paisagem visual') { props.paisagem = 1.0; }
    else if (lowerLabel === 'ambiência sonora') {
      props.ambiencia = 1.0;
      props.delayFeedback = 0.5;
    }
    else if (lowerLabel === 'joia') {
      props.joia = 1.0;
      props.resonance = 20.0;
    }
    else if (lowerLabel === 'objeto') { props.objeto = 1.0; }
    else if (lowerLabel === 'espaço') {
      props.espaco = 1.0;
      props.delayTime = 0.85;
    }
    else if (lowerLabel === 'ritual') { props.ritual = 1.0; }
    else if (lowerLabel === 'direção criativa') { props.criativa = 1.0; }
  }
  // 10. EMOÇÕES MÃE / SUB-EMOÇÕES
  else if (type === 'emoAlegria') {
    props.joy = 1.0; props.warmth = 0.4;
    // Euclidean deviations for specific sub-emotions
    if (lowerLabel === 'euforia') {
      props.joy = 1.2; props.expansion = 0.8; props.jitter = 0.6; props.elevation = 0.5;
    } else if (lowerLabel === 'satisfação') {
      props.joy = 0.8; props.warmth = 0.6; props.attack = 0.7; props.softness = 0.5;
    } else if (lowerLabel === 'serenidade') {
      props.joy = 0.7; props.softness = 1.0; props.attack = 1.5; props.transparency = 0.5;
    } else if (lowerLabel === 'êxtase') {
      props.joy = 1.5; props.expansion = 1.0; props.resonance = 0.6;
    } else if (lowerLabel === 'gratidão') {
      props.joy = 0.8; props.softness = 0.7; props.descent = 0.3; props.warmth = 0.4;
    }
  }
  else if (type === 'emoTristeza') {
    props.sadness = 1.0; props.coldness = 0.4;
    if (lowerLabel === 'melancolia') {
      props.sadness = 1.2; props.coldness = 0.5; props.delayTime = 0.8; props.delayFeedback = 0.6; props.descent = 0.5;
    } else if (lowerLabel === 'vazio') {
      props.sadness = 1.5; props.density = -0.5; props.etéreo = 0.9; props.transparency = 0.9; props.threshold = 0.3;
    } else if (lowerLabel === 'nostalgia') {
      props.sadness = 0.8; props.eco = 0.8; props.ghostTrails = 0.8; props.halftoneIntensity = 0.4;
    }
  }
  else if (type === 'emoRaiva') {
    props.anger = 1.0; props.warmth = 0.5;
    props.glitchIntensity = 0.6;
    if (lowerLabel === 'fúria') {
      props.anger = 1.5; props.glitchIntensity = 1.0; props.colorRed = 0.8; props.friction = 0.8; props.roughness = 0.9;
    } else if (lowerLabel === 'irritação') {
      props.anger = 0.7; props.jitter = 0.5; props.roughness = 0.4; props.halftoneIntensity = 0.3;
    }
  }
  else if (type === 'emoMedo') {
    props.fear = 1.0; props.coldness = 0.5;
    if (lowerLabel === 'ansiedade') {
      props.fear = 0.8; props.coldness = 0.4; props.jitter = 0.8; props.elevation = 0.4; props.chromaticAberration = 0.3;
    } else if (lowerLabel === 'pânico') {
      props.fear = 1.5; props.glitchIntensity = 0.8; props.pixelSort = 0.6; props.elevation = 0.8; props.jitter = 1.0;
    } else if (lowerLabel === 'hesitação') {
      props.fear = 0.5; props.attack = 0.9; props.jitter = 0.3; props.glitchIntensity = 0.3;
    }
  }

  return props;
}
