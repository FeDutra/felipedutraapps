/**
 * @file formatters.ts
 * @description Data formatting utilities for the PULSO ecosystem.
 */

export const formatDate = (date: any): string => {
  if (!date || !(date instanceof Date)) {
    // If it's a Firestore Timestamp (not FieldValue), convert it
    if (date && typeof date.toDate === 'function') {
      return formatDate(date.toDate());
    }
    // Fallback for FieldValue or null
    return '--/--/----';
  }

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
};

export const truncateText = (text: string, length = 100): string => {
  if (text.length <= length) return text;
  return text.substring(0, length) + '...';
};
