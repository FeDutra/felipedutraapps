import { Area } from '../../apps/pulso/types/pulso.types';

export interface AreaRoutingOptions {
  activeAreaId?: string;
  lastUsedAreaId?: string;
  currentRoute?: string;
}

export interface AreaRoutingResult {
  areaRef?: string;
  routing: {
    rawInput: string;
    cleanInput: string;
    sessionTarget?: string;
    secondaryTopics?: string[];
    intentType: string;
    shouldSendToLotus: boolean;
    shouldCreateSideNotes: boolean;
    contextHints: string[];
    routerVersion: string;
    confidence: number;
  };
}

export const routeInputToArea = (
  input: string,
  areas: Area[],
  options?: AreaRoutingOptions
): AreaRoutingResult => {
  const cleanInput = input.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  let bestMatch: Area | undefined;
  let secondaryTopics: string[] = [];
  let contextHints: string[] = [];
  let highestMatchScore = 0;

  for (const area of areas) {
    let score = 0;
    
    // Check keywords
    if (area.keywords) {
      for (const keyword of area.keywords) {
        const cleanKeyword = keyword.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (cleanInput.includes(cleanKeyword)) {
          score += 1;
        }
      }
    }
    
    // Check aliases
    if (area.aliases) {
      for (const alias of area.aliases) {
        const cleanAlias = alias.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (cleanInput.includes(cleanAlias)) {
          score += 2; // Aliases have higher weight
        }
      }
    }

    if (score > highestMatchScore) {
      highestMatchScore = score;
      bestMatch = area;
    } else if (score === highestMatchScore && score > 0) {
      // Conflict: add to secondary
      if (options?.activeAreaId && area.id === options.activeAreaId) {
        // Active area wins ties
        if (bestMatch) secondaryTopics.push(bestMatch.name);
        bestMatch = area;
      } else {
        secondaryTopics.push(area.name);
      }
    } else if (score > 0) {
      secondaryTopics.push(area.name);
    }
  }

  // Fallback to active area or last used area
  if (!bestMatch && options?.activeAreaId) {
    bestMatch = areas.find(a => a.id === options.activeAreaId);
  }
  if (!bestMatch && options?.lastUsedAreaId) {
    bestMatch = areas.find(a => a.id === options.lastUsedAreaId);
  }

  if (bestMatch?.contextHints) {
    contextHints = [...bestMatch.contextHints];
  }

  return {
    areaRef: bestMatch?.id,
    routing: {
      rawInput: input,
      cleanInput,
      sessionTarget: bestMatch?.name,
      secondaryTopics: secondaryTopics.length > 0 ? secondaryTopics : undefined,
      intentType: "conversation_command",
      shouldSendToLotus: true,
      shouldCreateSideNotes: false,
      contextHints,
      routerVersion: "1.0.0-lexical",
      confidence: highestMatchScore > 0 ? (highestMatchScore > 2 ? 0.9 : 0.6) : 0.1
    }
  };
};
