'use client';

import React from 'react';
import { FileText, Paperclip } from 'lucide-react';

export interface RenderableAttachment {
  id: string;
  name: string;
  type?: string;
  mimeType?: string;
  url: string;
  sizeBytes?: number;
}

interface MessageAttachmentsProps {
  attachments?: RenderableAttachment[];
  align?: 'start' | 'end';
  onPreviewImage?: (attachment: RenderableAttachment) => void;
  onPreviewPdf?: (attachment: RenderableAttachment) => void;
}

const formatSize = (sizeBytes?: number) => {
  if (!sizeBytes) return '';
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)}kb`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)}mb`;
};

export function MessageAttachments({
  attachments,
  align = 'start',
  onPreviewImage,
  onPreviewPdf,
}: MessageAttachmentsProps) {
  if (!attachments?.length) return null;

  return (
    <div className={`mt-2 flex flex-wrap gap-2 ${align === 'end' ? 'justify-end' : 'justify-start'}`}>
      {attachments.map((attachment) => {
        const mime = String(attachment.mimeType || '').toLowerCase();
        const kind = String(attachment.type || '').toLowerCase();
        const isImage = kind === 'image' || mime.startsWith('image/');
        const isAudio = kind === 'audio' || mime.startsWith('audio/');
        const isVideo = kind === 'video' || mime.startsWith('video/');
        const isPdf = kind === 'pdf' || mime === 'application/pdf' || attachment.name.toLowerCase().endsWith('.pdf');

        if (isImage) {
          return (
            <figure key={attachment.id} className="flex w-full max-w-[220px] flex-col gap-1">
              <button
                type="button"
                onClick={() => onPreviewImage ? onPreviewImage(attachment) : window.open(attachment.url, '_blank', 'noopener,noreferrer')}
                className="group relative max-h-32 cursor-pointer overflow-hidden rounded-lg border border-white/10 bg-transparent p-0"
                title={`Abrir ${attachment.name}`}
              >
                <img
                  src={attachment.url}
                  alt={attachment.name}
                  loading="lazy"
                  className="h-28 w-full object-cover transition-transform group-hover:scale-[1.02]"
                />
              </button>
              <figcaption className="truncate px-1 text-left text-[9px] font-light text-[#fbf9f5]/40" title={attachment.name}>
                {attachment.name}
              </figcaption>
            </figure>
          );
        }

        if (isAudio) {
          return (
            <div key={attachment.id} className="mt-1 flex w-full max-w-xs flex-col gap-1">
              <audio controls preload="metadata" src={attachment.url} className="h-8 w-full opacity-80 transition-opacity hover:opacity-100" />
              <span className="truncate px-1 text-left text-[9px] font-light text-[#fbf9f5]/40" title={attachment.name}>{attachment.name}</span>
            </div>
          );
        }

        if (isVideo) {
          return (
            <figure key={attachment.id} className="mt-1 flex w-full max-w-sm flex-col gap-1">
              <video controls preload="metadata" src={attachment.url} className="max-h-52 w-full rounded-lg border border-white/10 bg-black/20" />
              <figcaption className="truncate px-1 text-left text-[9px] font-light text-[#fbf9f5]/40" title={attachment.name}>{attachment.name}</figcaption>
            </figure>
          );
        }

        if (isPdf) {
          return (
            <button
              key={attachment.id}
              type="button"
              onClick={() => onPreviewPdf ? onPreviewPdf(attachment) : window.open(attachment.url, '_blank', 'noopener,noreferrer')}
              className="mt-1 flex w-full max-w-xs cursor-pointer flex-col gap-1 bg-transparent p-0 text-left"
            >
              <span className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 transition-colors hover:bg-white/10">
                <FileText size={14} className="shrink-0 text-[#b8283e]" />
                <span className="text-[9px] font-medium uppercase tracking-widest text-[#fbf9f5]/40">pdf {formatSize(attachment.sizeBytes) && `• ${formatSize(attachment.sizeBytes)}`}</span>
              </span>
              <span className="truncate px-1 text-[9px] font-light text-[#fbf9f5]/40" title={attachment.name}>{attachment.name}</span>
            </button>
          );
        }

        return (
          <a
            key={attachment.id}
            href={attachment.url}
            download={attachment.name}
            target="_blank"
            rel="noreferrer"
            className="mt-1 flex w-full max-w-xs flex-col gap-1"
          >
            <span className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-left transition-colors hover:bg-white/10">
              <Paperclip size={14} className="shrink-0 text-white/40" />
              <span className="text-[9px] font-medium uppercase tracking-widest text-[#fbf9f5]/40">arquivo {formatSize(attachment.sizeBytes) && `• ${formatSize(attachment.sizeBytes)}`}</span>
            </span>
            <span className="truncate px-1 text-left text-[9px] font-light text-[#fbf9f5]/40" title={attachment.name}>{attachment.name}</span>
          </a>
        );
      })}
    </div>
  );
}

