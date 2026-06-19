import { Status, Priority, Severity } from "../types/pulso.types";

/**
 * @file pulsoUIHelpers.ts
 * @description UI-specific helpers for the PULSO interface.
 */

export const semanticColors = {
  red: {
    bg: 'bg-[#b8283e]/10',
    border: 'border-[#b8283e]/25',
    text: 'text-[#e89083]',
    glow: 'shadow-[0_0_15px_rgba(184, 40, 62,0.15)]',
    dot: 'bg-[#b8283e]'
  },
  amber: {
    bg: 'bg-[#cbb291]/15',
    border: 'border-[#cbb291]/25',
    text: 'text-[#dfcfbc]',
    glow: 'shadow-none',
    dot: 'bg-[#cbb291]'
  },
  emerald: {
    bg: 'bg-[#7a8c77]/15',
    border: 'border-[#7a8c77]/25',
    text: 'text-[#a5b5a2]',
    glow: 'shadow-none',
    dot: 'bg-[#7a8c77]'
  },
  blue: {
    bg: 'bg-[#8ea0b0]/15',
    border: 'border-[#8ea0b0]/25',
    text: 'text-[#b8c6d4]',
    glow: 'shadow-none',
    dot: 'bg-[#8ea0b0]'
  },
  slate: {
    bg: 'bg-white/5',
    border: 'border-white/10',
    text: 'text-[#fbf9f5]/65',
    glow: 'shadow-none',
    dot: 'bg-white/20'
  }
};

export const getStatusTheme = (status: Status) => {
  if (['active', 'in_progress', 'completed', 'resolved', 'converted'].includes(status)) return semanticColors.emerald;
  if (['blocked', 'broken', 'critical', 'open'].includes(status)) return semanticColors.red;
  if (['paused', 'maintenance', 'triaged'].includes(status)) return semanticColors.amber;
  if (['new', 'acknowledged'].includes(status)) return semanticColors.blue;
  return semanticColors.slate;
};

export const getPriorityTheme = (priority: Priority) => {
  if (priority === 'critical') return semanticColors.red;
  if (priority === 'high') return semanticColors.amber;
  if (priority === 'medium') return semanticColors.blue;
  return semanticColors.slate;
};

export const getSeverityTheme = (severity: Severity) => {
  if (severity === 'critical') return semanticColors.red;
  if (severity === 'high') return semanticColors.amber;
  if (severity === 'medium') return semanticColors.blue;
  if (severity === 'info') return semanticColors.slate;
  return semanticColors.slate;
};
