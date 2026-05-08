import { LunarData } from '@/shared/types';
import { mockLunar } from '@/shared/mocks/data';

/**
 * Service to handle lunar data from Google Maps Platform Weather API
 * In MVP mode, it returns mock data formatted according to the API structure.
 */
export const lunarService = {
  /**
   * Fetches lunar data for a specific date and location.
   * Currently uses mock data.
   */
  getLunarData: async (date: Date = new Date(), lat?: number, lng?: number): Promise<LunarData> => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // Google Weather API simulation logic for moonPhase
    // 0 = New Moon
    // 0.25 = First Quarter
    // 0.5 = Full Moon
    // 0.75 = Last Quarter
    
    // For the mock, we vary the phase based on the day of the month for demonstration
    const day = date.getDate();
    const cyclePos = (day % 30) / 30;
    
    let phaseName = 'Nova';
    if (cyclePos > 0 && cyclePos < 0.25) phaseName = 'Crescente';
    else if (cyclePos >= 0.25 && cyclePos < 0.5) phaseName = 'Quarto Crescente';
    else if (cyclePos >= 0.5 && cyclePos < 0.75) phaseName = 'Cheia';
    else if (cyclePos >= 0.75 && cyclePos < 1) phaseName = 'Minguante';

    return {
      ...mockLunar,
      phase: phaseName,
      moonPhase: cyclePos,
      illumination: Math.abs(Math.sin(cyclePos * Math.PI)) * 100,
    };
  },

  /**
   * Get a list of lunar data for a range of days (Timeline)
   */
  getLunarHistory: async (days: number = 30): Promise<LunarData[]> => {
    const today = new Date();
    const historyPromises = Array.from({ length: days }).map((_, i) => {
      const date = new Date(today);
      date.setDate(today.getDate() - 15 + i);
      
      const cyclePos = (date.getDate() % 30) / 30;
      let phaseName = 'Nova';
      if (cyclePos > 0 && cyclePos < 0.25) phaseName = 'Crescente';
      else if (cyclePos >= 0.25 && cyclePos < 0.5) phaseName = 'Quarto Crescente';
      else if (cyclePos >= 0.5 && cyclePos < 0.75) phaseName = 'Cheia';
      else if (cyclePos >= 0.75 && cyclePos < 1) phaseName = 'Minguante';

      return {
        ...mockLunar,
        phase: phaseName,
        moonPhase: cyclePos,
        illumination: Math.abs(Math.sin(cyclePos * Math.PI)) * 100,
      };
    });

    return historyPromises;
  }
};
