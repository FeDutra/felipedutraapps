export function normalizeTranscript(rawText: string): string {
  if (!rawText) return '';
  
  // 1. Trim and remove double spaces
  let text = rawText.trim().replace(/\s+/g, ' ');

  // 2. Dictionary map for spoken Portuguese transcription shortcuts, slang, and capitalization
  const dictionary: Record<string, string> = {
    'lotus': 'Lótus',
    'lótus': 'Lótus',
    'fe': 'Fê',
    'fê': 'Fê',
    'voce': 'você',
    'voces': 'vocês',
    'nao': 'não',
    'tb': 'também',
    'tambem': 'também',
    'pq': 'porque',
    'ta': 'está',
    'tá': 'está',
    'vc': 'você',
    'vcs': 'vocês',
    'pra': 'para',
    'eh': 'é',
    'tava': 'estava',
    'pro': 'para o',
    'dai': 'daí',
    'ja': 'já',
    'so': 'só',
    'ate': 'até',
    'nois': 'nós',
    'mais ou menos': 'mais ou menos',
    'agente': 'a gente'
  };

  // Replace words matching dictionary keys exactly on word boundaries
  Object.entries(dictionary).forEach(([key, replacement]) => {
    const regex = new RegExp(`\\b${key}\\b`, 'gi');
    text = text.replace(regex, (match) => {
      // Preserve uppercase first letter if raw matched word had it capitalized
      if (match.charAt(0) === match.charAt(0).toUpperCase()) {
        return replacement.charAt(0).toUpperCase() + replacement.slice(1);
      }
      return replacement;
    });
  });

  // Inject commas automatically before common conjunctions for natural phrasing
  text = text.replace(/\s+(porque|mas|pois|porém|contudo|entretanto)\b/gi, ', $1');

  // Clean double commas or misplaced whitespace around commas
  text = text.replace(/,+/g, ',').replace(/\s*,\s*/g, ', ');

  // 3. Capitalize first letter
  if (text.length > 0) {
    text = text.charAt(0).toUpperCase() + text.slice(1);
  }

  // 4. Capitalize after punctuation (. ? !)
  text = text.replace(/([.?!])\s+([a-zA-Záéíóúâêôãõç])/g, (match, p1, p2) => {
    return p1 + ' ' + p2.toUpperCase();
  });

  // 5. Simple heuristics to add punctuation at the end if missing
  if (!/[.?!]$/.test(text)) {
    const lowerText = text.toLowerCase();
    const questionStarters = [
      'quais', 'qual', 'como', 'onde', 'por que', 'porque', 
      'quem', 'quando', 'o que', 'cadê', 'você', 'será'
    ];
    const startsWithQuestionWord = questionStarters.some(word => lowerText.startsWith(word));
    
    if (startsWithQuestionWord) {
      text += '?';
    } else {
      text += '.';
    }
  }

  return text;
}
