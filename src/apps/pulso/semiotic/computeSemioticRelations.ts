import { BaseProperties, getInitialProps } from './semioticGrammar';
import { getBaseProps } from './elementRegistry';
import { getCompoundProps } from './compoundRegistry';

interface CanvasNode {
  id: string;
  label: string;
  x: number;
  y: number;
  type: string;
  colorValue?: string;
  intensity?: number;
  snappedToId?: string;
}

export interface ComputedRelations {
  activeModulations: Map<string, BaseProperties>;
  contaminatedColors: Map<string, string | null>;
  interferenceZones: Array<{
    x: number;
    y: number;
    size: number;
    labelA: string;
    labelB: string;
    typeA: string;
    typeB: string;
  }>;
}

export function computeSemioticRelations(nodes: CanvasNode[]): ComputedRelations {
  const activeModulations = new Map<string, BaseProperties>();
  const contaminatedColors = new Map<string, string | null>();
  const colorWeights = new Map<string, number>();
  const interferenceZones: Array<{
    x: number;
    y: number;
    size: number;
    labelA: string;
    labelB: string;
    typeA: string;
    typeB: string;
  }> = [];

  // Initialize targets
  nodes.forEach(n => {
    activeModulations.set(n.id, getInitialProps());
    contaminatedColors.set(n.id, null);
    colorWeights.set(n.id, 0);
  });

  const elements = nodes.filter(n => n.type !== 'som' && n.type !== 'imagem');
  const targets = nodes.filter(n => n.type === 'som' || n.type === 'imagem');

  // For each target, compute the influence of elements and compounds
  targets.forEach(target => {
    const targetProps = getInitialProps();
    const consumedElementIds = new Set<string>();

    // 1. Detect elements in range (200px)
    const elementsInRange = elements.map(el => {
      const isSnapped = el.snappedToId === target.id;
      const dist = isSnapped ? 30 : Math.hypot(el.x - target.x, el.y - target.y);
      return { el, dist, weight: Math.max(0, 1.0 - dist / 200) };
    }).filter(item => item.weight > 0);

    // 2. Identify compounds within elements in range
    // A compound forms if two elements are within 100px of each other
    for (let i = 0; i < elementsInRange.length; i++) {
      for (let j = i + 1; j < elementsInRange.length; j++) {
        const itemA = elementsInRange[i];
        const itemB = elementsInRange[j];

        const elDist = Math.hypot(itemA.el.x - itemB.el.x, itemA.el.y - itemB.el.y);
        if (elDist < 100) {
          // Check if there is a compound definition
          const compProps = getCompoundProps(itemA.el.label, itemB.el.label);
          if (compProps) {
            const compoundWeight = Math.max(0, 1.0 - elDist / 100);
            const avgTargetWeight = (itemA.weight + itemB.weight) / 2;
            const finalWeight = compoundWeight * avgTargetWeight;

            // Apply compound properties to target
            Object.keys(targetProps).forEach(k => {
              const key = k as keyof BaseProperties;
              const val = compProps[key] ?? 0;
              targetProps[key] = (targetProps[key] ?? 0) + val * finalWeight;
            });

            // Mark these elements as consumed
            consumedElementIds.add(itemA.el.id);
            consumedElementIds.add(itemB.el.id);

            // Record as interference zone for visual overlay representation
            interferenceZones.push({
              x: (itemA.el.x + itemB.el.x) / 2,
              y: (itemA.el.y + itemB.el.y) / 2,
              size: 60 * finalWeight,
              labelA: itemA.el.label,
              labelB: itemB.el.label,
              typeA: itemA.el.type,
              typeB: itemB.el.type
            });
          }
        }
      }
    }

    // 3. Apply remaining unconsumed elements using the Dominance Hierarchy
    const unconsumedElements = elementsInRange.filter(item => !consumedElementIds.has(item.el.id));
    // Sort descending by weight (proximity)
    unconsumedElements.sort((a, b) => b.weight - a.weight);

    unconsumedElements.forEach((item, idx) => {
      const baseProps = getBaseProps(item.el.type, item.el.label);
      
      // Determine dominance hierarchy multiplier
      let dominanceScale = 1.0; // Tier 1: Dominant Element (closest)
      if (idx > 0) {
        if (item.weight > 0.4) {
          dominanceScale = 0.6; // Tier 2: Modifier Element
        } else {
          dominanceScale = 0.25; // Tier 3: Field Residue
        }
      }

      Object.keys(targetProps).forEach(k => {
        const key = k as keyof BaseProperties;
        const val = baseProps[key] ?? 0;
        targetProps[key] = (targetProps[key] ?? 0) + val * item.weight * dominanceScale;
      });

      // Handle color contamination
      if (item.el.type === 'cor') {
        const currentWeight = colorWeights.get(target.id) || 0;
        if (item.weight > currentWeight) {
          contaminatedColors.set(target.id, item.el.colorValue || '#fbf9f5');
          colorWeights.set(target.id, item.weight);
        }
      }
    });

    activeModulations.set(target.id, targetProps);
  });

  return { activeModulations, contaminatedColors, interferenceZones };
}
