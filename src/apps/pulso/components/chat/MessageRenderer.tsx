import React from 'react';
import { 
  Zap, 
  Clock, 
  Check, 
  AlertTriangle, 
  Volume2, 
  Square, 
  Copy, 
  Code,
  Layers,
  FileText,
  Video,
  Link2,
  Image as ImageIcon
} from 'lucide-react';

export interface OpenClawResult {
  processedBy: string;
  responseText: string;
  summary?: string;
  confidence?: string;
  riskLevel?: string;
  requiresHumanApproval?: boolean;
  statusTransition?: string;
  sourcesConsulted?: string[];
  proposedActions?: Array<{ label: string; description?: string; riskLevel?: string }>;
  proposedMutation?: { type: string; previewLabel: string; payload: any };
  processedAt?: string;
  createdAt?: string;
  links?: Array<{ label: string; url: string }>;
  actions?: Array<{ label: string; type: string; payload?: any; requiresConfirmation?: boolean }>;
  errors?: string[];
}

export interface Message {
  id: string;
  sender: 'user' | 'lotus' | 'system';
  text: string;
  timestamp: Date | any;
  interpretation?: any;
  openclawResult?: OpenClawResult;
  handoffStatus?: string;
  requestId?: string;
  originalCommand?: string;
  executedAt?: string;
  executedBy?: string;
  createdEntityRef?: string;
  executionError?: string;
  replyTo?: { id: string; sender: string; text: string } | null;
}

interface Block {
  type: 'text' | 'table' | 'code' | 'json';
  content: string;
  language?: string;
}

// Safe date conversion helper
const safeConvertToDate = (dateInput: any): Date | null => {
  if (!dateInput) return null;
  if (dateInput instanceof Date) return dateInput;
  if (typeof dateInput === 'object' && typeof dateInput.toDate === 'function') {
    return dateInput.toDate();
  }
  if (typeof dateInput === 'object' && typeof dateInput.seconds === 'number') {
    return new Date(dateInput.seconds * 1000);
  }
  if (typeof dateInput === 'string') {
    const t = Date.parse(dateInput);
    return isNaN(t) ? null : new Date(t);
  }
  return null;
};

// Formats message date as HH:MM or DD Month · HH:MM
export const formatMessageTimestamp = (dateInput: any): string => {
  const date = safeConvertToDate(dateInput);
  if (!date) return '';
  
  const now = new Date();
  const isToday = date.getDate() === now.getDate() &&
                  date.getMonth() === now.getMonth() &&
                  date.getFullYear() === now.getFullYear();
                  
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const timeStr = `${hours}:${minutes}`;
  
  if (isToday) {
    return timeStr;
  }
  
  const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const day = date.getDate();
  const month = months[date.getMonth()];
  return `${day} ${month} · ${timeStr}`;
};

// Extracts unique URLs from text
export const extractUrls = (text: string): string[] => {
  const URL_REGEX = /(https?:\/\/[^\s]+)/g;
  const matches = text.match(URL_REGEX) || [];
  return Array.from(new Set(matches.map(u => u.trim())));
};

// Formats normal text line, replacing bold formatting and raw links
const formatTextLine = (text: string) => {
  if (!text) return null;
  
  const URL_REGEX = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(URL_REGEX);
  
  return parts.map((part, index) => {
    const isUrl = part.match(URL_REGEX);
    if (isUrl) {
      const url = part.trim();
      let label = 'link';
      try {
        const parsedUrl = new URL(url);
        const host = parsedUrl.hostname.replace('www.', '');
        if (host.includes('notion.so')) label = 'notion';
        else if (host.includes('drive.google.com') || host.includes('docs.google.com')) label = 'google drive';
        else if (host.includes('meet.google.com') || host.includes('zoom.us') || host.includes('teams.microsoft.com')) label = 'reunião';
        else label = host;
      } catch {}
      
      return (
        <a
          key={index}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-white underline font-normal hover:text-white/80 transition-colors mx-0.5 inline-flex items-center gap-0.5"
        >
          {label}
        </a>
      );
    }
    
    const boldParts = part.split(/(\*\*[^*]+\*\*)/g);
    return boldParts.map((bp, bpIdx) => {
      if (bp.startsWith('**') && bp.endsWith('**')) {
        return (
          <strong key={`${index}-${bpIdx}`} className="font-bold text-white">
            {bp.slice(2, -2)}
          </strong>
        );
      }
      return bp;
    });
  });
};

// Renders blocks of text, separating paragraphs
const TextBlockRenderer = ({ content }: { content: string }) => {
  const lines = content.split('\n');
  return (
    <div className="space-y-1">
      {lines.map((line, idx) => {
        if (line.trim() === '') return <div key={idx} className="h-2" />;
        return (
          <div key={idx} className="leading-relaxed">
            {formatTextLine(line)}
          </div>
        );
      })}
    </div>
  );
};

// Renders markdown tables with responsive scroll and limit-based expand/collapse
const TableRenderer = ({ content }: { content: string }) => {
  const [isExpanded, setIsExpanded] = React.useState(false);
  
  const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return <div className="text-xs text-white/50">{content}</div>;
  
  const headers = lines[0].split('|').map(h => h.trim()).filter((_, i, arr) => i > 0 && i < arr.length - 1);
  const rows = lines.slice(2).map(line => {
    return line.split('|').map(cell => cell.trim()).filter((_, i, arr) => i > 0 && i < arr.length - 1);
  });
  
  const hasManyRows = rows.length > 5;
  const displayedRows = isExpanded ? rows : rows.slice(0, 5);
  
  return (
    <div className="my-3 space-y-1.5 w-full">
      <div className="overflow-x-auto no-scrollbar rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm max-w-full">
        <table className="w-full text-left border-collapse text-xs text-white/90 font-light min-w-[320px]">
          <thead>
            <tr className="border-b border-white/10 bg-white/10 select-none">
              {headers.map((h, i) => (
                <th key={i} className="px-4 py-2 font-semibold tracking-wider uppercase text-[9px] text-white/70">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {displayedRows.map((row, rIdx) => (
              <tr key={rIdx} className="hover:bg-white/5 transition-colors">
                {row.map((cell, cIdx) => (
                  <td key={cIdx} className="px-4 py-2 whitespace-pre-wrap">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {hasManyRows && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
          className="text-[9px] font-medium tracking-widest text-[#fbf9f5]/50 hover:text-white uppercase transition-colors bg-transparent border-none outline-none cursor-pointer"
        >
          {isExpanded ? '[ recolher tabela ]' : `[ mostrar mais ${rows.length - 5} linhas ]`}
        </button>
      )}
    </div>
  );
};

// Renders JSON structures, collapsed by default
const JSONRenderer = ({ content }: { content: string }) => {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  
  let formatted = content;
  try {
    const parsed = JSON.parse(content);
    formatted = JSON.stringify(parsed, null, 2);
  } catch {}
  
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(formatted).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  
  return (
    <div className="my-3 rounded-xl border border-white/10 bg-black/30 overflow-hidden font-mono text-[11px] text-white/80 w-full">
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 bg-white/5 select-none">
        <span className="text-[9px] font-bold tracking-widest uppercase text-white/50">json pacote</span>
        <div className="flex items-center gap-3">
          <button
            onClick={handleCopy}
            className="text-[9px] tracking-wider text-white/50 hover:text-white transition-colors bg-transparent border-none cursor-pointer outline-none"
          >
            {copied ? 'copiado' : 'copiar'}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="text-[9px] tracking-wider text-white/50 hover:text-white transition-colors bg-transparent border-none cursor-pointer outline-none font-bold"
          >
            {isExpanded ? 'ocultar' : 'ver pacote'}
          </button>
        </div>
      </div>
      
      {isExpanded ? (
        <pre className="p-4 overflow-x-auto no-scrollbar max-h-[300px] whitespace-pre-wrap leading-relaxed border-t border-white/5 bg-black/20 text-left">
          {formatted}
        </pre>
      ) : (
        <div className="px-4 py-3 text-white/40 italic cursor-pointer select-none text-left" onClick={() => setIsExpanded(true)}>
          {`{ ... } (${formatted.length} caracteres)`}
        </div>
      )}
    </div>
  );
};

// Renders standard code blocks with copy action
const CodeRenderer = ({ content, language }: { content: string, language?: string }) => {
  const [copied, setCopied] = React.useState(false);
  
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  
  return (
    <div className="my-3 rounded-xl border border-white/10 bg-black/40 overflow-hidden font-mono text-[11px] text-white/90 w-full">
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 bg-white/5 select-none">
        <span className="text-[9px] font-bold tracking-widest uppercase text-white/50">{language || 'código'}</span>
        <button
          onClick={handleCopy}
          className="text-[9px] tracking-wider text-white/50 hover:text-white transition-colors bg-transparent border-none cursor-pointer outline-none"
        >
          {copied ? 'copiado' : 'copiar'}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto no-scrollbar whitespace-pre leading-relaxed bg-black/25 text-left">
        {content}
      </pre>
    </div>
  );
};

// Renders unique detected links as beautiful glassmorphic action cards
export const LinkButtonRenderer = ({ urls }: { urls: string[] }) => {
  if (urls.length === 0) return null;
  
  return (
    <div className="flex flex-wrap gap-2 mt-3 select-none">
      {urls.map((url, idx) => {
        let label = 'abrir link';
        let IconComponent = Link2;
        
        try {
          const parsedUrl = new URL(url);
          const host = parsedUrl.hostname.toLowerCase();
          
          if (host.includes('notion.so')) {
            label = 'abrir notion';
            IconComponent = Layers;
          } else if (host.includes('drive.google.com') || host.includes('docs.google.com')) {
            label = 'abrir drive';
            IconComponent = FileText;
          } else if (host.includes('meet.google.com') || host.includes('zoom.us') || host.includes('teams.microsoft.com')) {
            label = 'abrir reunião';
            IconComponent = Video;
          } else {
            const pathname = parsedUrl.pathname.toLowerCase();
            if (pathname.endsWith('.pdf') || pathname.endsWith('.docx') || pathname.endsWith('.xlsx') || pathname.endsWith('.zip')) {
              label = 'abrir arquivo';
              IconComponent = FileText;
            } else if (pathname.endsWith('.png') || pathname.endsWith('.jpg') || pathname.endsWith('.jpeg') || pathname.endsWith('.gif')) {
              label = 'abrir imagem';
              IconComponent = ImageIcon;
            } else {
              label = host.replace('www.', '');
            }
          }
        } catch {}
        
        return (
          <a
            key={idx}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="px-3 py-1.5 bg-[#fbf9f5]/5 hover:bg-[#fbf9f5]/10 backdrop-blur-md border border-[#fbf9f5]/10 hover:border-[#fbf9f5]/20 rounded-lg text-[9px] tracking-wider font-light text-white/80 hover:text-white transition-all select-none lowercase cursor-pointer inline-flex items-center gap-1.5"
          >
            <IconComponent size={11} strokeWidth={1.5} className="opacity-75" />
            <span>{label}</span>
          </a>
        );
      })}
    </div>
  );
};

// Parse raw text into structured blocks
const parseBlocks = (text: string): Block[] => {
  if (!text) return [];
  
  const parts = text.split(/(```[\s\S]*?```)/g);
  const blocks: Block[] = [];
  
  for (const part of parts) {
    if (part.startsWith('```') && part.endsWith('```')) {
      const match = part.match(/```(\w*)\n([\s\S]*?)```/);
      const language = match ? match[1].toLowerCase() : '';
      const content = match ? match[2] : part.slice(3, -3);
      
      let isJson = language === 'json';
      if (!isJson && (content.trim().startsWith('{') || content.trim().startsWith('['))) {
        try {
          JSON.parse(content.trim());
          isJson = true;
        } catch {}
      }
      
      blocks.push({
        type: isJson ? 'json' : 'code',
        content,
        language
      });
    } else {
      const lines = part.split('\n');
      let currentTableLines: string[] = [];
      
      for (const line of lines) {
        const trimmed = line.trim();
        const isTableLine = trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.length > 1;
        
        if (isTableLine) {
          currentTableLines.push(trimmed);
        } else {
          if (currentTableLines.length > 0) {
            blocks.push({
              type: 'table',
              content: currentTableLines.join('\n')
            });
            currentTableLines = [];
          }
          if (blocks.length > 0 && blocks[blocks.length - 1].type === 'text') {
            blocks[blocks.length - 1].content += '\n' + line;
          } else {
            blocks.push({
              type: 'text',
              content: line
            });
          }
        }
      }
      
      if (currentTableLines.length > 0) {
        blocks.push({
          type: 'table',
          content: currentTableLines.join('\n')
        });
      }
    }
  }
  
  return blocks.filter(b => b.content.trim() !== '');
};

// Main Message Renderer Component
export const MessageRenderer = ({ text, sender }: { text: string; sender: string }) => {
  if (sender === 'system') {
    return <span className="text-xs text-[#fbf9f5]/55 italic block">{text}</span>;
  }
  
  const blocks = parseBlocks(text);
  const detectedUrls = extractUrls(text);
  
  return (
    <div className="w-full space-y-2">
      <div className="space-y-3">
        {blocks.map((block, idx) => {
          if (block.type === 'table') {
            return <TableRenderer key={idx} content={block.content} />;
          }
          if (block.type === 'json') {
            return <JSONRenderer key={idx} content={block.content} />;
          }
          if (block.type === 'code') {
            return <CodeRenderer key={idx} content={block.content} language={block.language} />;
          }
          return <TextBlockRenderer key={idx} content={block.content} />;
        })}
      </div>
      
      {detectedUrls.length > 0 && <LinkButtonRenderer urls={detectedUrls} />}
    </div>
  );
};

// Actions bar rendering component
interface MessageActionsProps {
  msg: Message;
  playingMsgId: string | null;
  playingState: 'stopped' | 'preparing' | 'playing' | 'error/fallback';
  onHearClick: (msg: Message) => void;
  onCopyText: (msg: Message) => void;
  onCopyPackage: (msg: Message) => void;
  onReply?: (msg: Message) => void;
}

export const MessageActions = ({
  msg,
  playingMsgId,
  playingState,
  onHearClick,
  onCopyText,
  onCopyPackage,
  onReply
}: MessageActionsProps) => {
  const isPlayingThis = playingMsgId === msg.id;
  const isPreparing = isPlayingThis && playingState === 'preparing';
  const isCurrentlyPlaying = isPlayingThis && playingState === 'playing';
  
  const showHandoffStatus = msg.handoffStatus === 'waiting_user_approval' || 
                            msg.handoffStatus === 'executed' || 
                            (msg.openclawResult?.errors && msg.openclawResult.errors.length > 0);

  return (
<div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between text-left select-none">
      {/* Handoff Status & Timestamp */}
      <div className="flex items-center gap-2 text-[9px] text-[#fbf9f5]/60 font-light lowercase">
        {msg.handoffStatus === 'waiting_user_approval' ? (
          <><Clock size={10} strokeWidth={1.5} /><span>aguarda aprovação</span></>
        ) : msg.handoffStatus === 'executed' ? (
          <><Check size={10} strokeWidth={1.5} className="text-white/90" /><span>executada</span></>
        ) : msg.openclawResult?.errors && msg.openclawResult.errors.length > 0 ? (
          <><AlertTriangle size={10} strokeWidth={1.5} className="text-white" /><span>falha</span></>
        ) : (
          <Zap size={10} strokeWidth={1.5} className="opacity-60 text-white" />
        )}
        <span className="opacity-75 font-light">
          {formatMessageTimestamp(msg.timestamp)}
        </span>
      </div>

      {/* Operations Bar */}
      <div className="flex items-center gap-3">
        {/* Reply Action */}
        {onReply && (
          <button
            onClick={() => onReply(msg)}
            className="text-[#fbf9f5]/40 hover:text-white transition-colors bg-transparent border-none cursor-pointer outline-none"
            title="Responder esta mensagem"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 17 4 12 9 7" />
              <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
            </svg>
          </button>
        )}

        {/* Hear Action */}
        <button
          onClick={() => onHearClick(msg)}
          className={`text-[#fbf9f5]/40 hover:text-white transition-colors bg-transparent border-none cursor-pointer outline-none flex items-center gap-1.5`}
          title={isCurrentlyPlaying ? "Parar áudio" : isPreparing ? "Preparando áudio..." : "Ouvir resposta"}
        >
          {isCurrentlyPlaying ? (
            <Square size={11} strokeWidth={1.5} />
          ) : (
            <Volume2 size={11} strokeWidth={1.5} className={isPreparing ? "animate-pulse text-white/80" : ""} />
          )}
        </button>

        {/* Copy Text Action */}
        <button
          onClick={() => onCopyText(msg)}
          className="text-[#fbf9f5]/40 hover:text-white transition-colors bg-transparent border-none cursor-pointer outline-none"
          title="Copiar texto visível"
        >
          <Copy size={11} strokeWidth={1.5} />
        </button>

        {/* Copy Handoff Package Action */}
        {msg.openclawResult && (
          <button
            onClick={() => onCopyPackage(msg)}
            className="text-[#fbf9f5]/40 hover:text-white transition-colors bg-transparent border-none cursor-pointer outline-none"
            title="Copiar pacote técnico JSON"
          >
            <Code size={11} strokeWidth={1.5} />
          </button>
        )}
      </div>
    </div>
  );
};
