/**
 * @file formatters.ts
 * @description Data formatting utilities for the PULSO ecosystem.
 */

export const safeConvertToDate = (dateInput: any): Date | null => {
  if (!dateInput) return null;
  if (dateInput instanceof Date) return dateInput;
  if (typeof dateInput === 'object' && typeof dateInput.toDate === 'function') {
    try {
      return dateInput.toDate();
    } catch (e) {
      console.error('Error calling toDate()', e);
    }
  }
  if (typeof dateInput === 'object' && typeof dateInput.seconds === 'number') {
    return new Date(dateInput.seconds * 1000);
  }
  if (typeof dateInput === 'string' || typeof dateInput === 'number') {
    const t = typeof dateInput === 'number' ? dateInput : Date.parse(dateInput);
    return isNaN(t) ? null : new Date(t);
  }
  return null;
};

export const safeGetTime = (dateInput: any): number => {
  const d = safeConvertToDate(dateInput);
  return d ? d.getTime() : 0;
};

export const formatDate = (date: any): string => {
  const d = safeConvertToDate(date);
  if (!d) return '--/--/----';

  try {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(d);
  } catch (e) {
    return '--/--/----';
  }
};

export const truncateText = (text: string, length = 100): string => {
  if (text.length <= length) return text;
  return text.substring(0, length) + '...';
};
