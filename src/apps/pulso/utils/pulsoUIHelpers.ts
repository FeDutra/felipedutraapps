import { Status, Priority, Severity } from "../types/pulso.types";

/**
 * @file pulsoUIHelpers.ts
 * @description UI-specific helpers for the PULSO interface.
 */

export const semanticColors = {
  red: {
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    text: 'text-red-400',
    glow: 'shadow-[0_0_15px_rgba(239,68,68,0.2)]',
    dot: 'bg-red-500'
  },
  amber: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    text: 'text-amber-400',
    glow: 'shadow-[0_0_15px_rgba(245,158,11,0.2)]',
    dot: 'bg-amber-500'
  },
  emerald: {
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    text: 'text-emerald-400',
    glow: 'shadow-[0_0_15px_rgba(16,185,129,0.2)]',
    dot: 'bg-emerald-500'
  },
  blue: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    text: 'text-blue-400',
    glow: 'shadow-[0_0_15px_rgba(59,130,246,0.2)]',
    dot: 'bg-blue-500'
  },
  slate: {
    bg: 'bg-slate-500/10',
    border: 'border-slate-500/20',
    text: 'text-slate-400',
    glow: 'shadow-none',
    dot: 'bg-slate-500'
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
