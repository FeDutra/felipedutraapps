import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { X, Copy, Download, Edit3, Save, Share2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface MesaArtifact {
  id: string;
  title: string;
  content: string;
  contextId?: string;
}

interface MesaPanelProps {
  isOpen: boolean;
  onClose: () => void;
  artifact: MesaArtifact | null;
  onSave?: (id: string, content: string) => void;
}

export function MesaPanel({ isOpen, onClose, artifact, onSave }: MesaPanelProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    if (artifact) {
      setEditedContent(artifact.content);
      setIsEditing(false);
    }
  }, [artifact]);

  if (!isOpen || !artifact) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(isEditing ? editedContent : artifact.content);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([isEditing ? editedContent : artifact.content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${artifact.title.replace(/\s+/g, '_').toLowerCase()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSave = () => {
    if (onSave) {
      onSave(artifact.id, editedContent);
    }
    setIsEditing(false);
  };

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 20 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="h-full w-full bg-black/85 backdrop-blur-xl flex flex-col relative overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-light tracking-widest text-white/50 lowercase">
              [ mesa ]
            </span>
            <h2 className="text-sm font-light text-white tracking-wide">
              {artifact.title}
            </h2>
          </div>
          
          <div className="flex items-center gap-2">
            {!isEditing ? (
              <button 
                onClick={() => setIsEditing(true)}
                className="p-1.5 text-white/50 hover:text-white transition-colors bg-transparent border-none outline-none cursor-pointer"
                title="Editar"
              >
                <Edit3 size={14} />
              </button>
            ) : (
              <button 
                onClick={handleSave}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] uppercase tracking-wider text-white transition-colors bg-transparent border-none outline-none cursor-pointer font-mono"
              >
                <Save size={12} /> Salvar
              </button>
            )}

            <button 
              onClick={handleCopy}
              className="p-1.5 text-white/50 hover:text-white transition-colors bg-transparent border-none outline-none cursor-pointer"
              title="Copiar Markdown"
            >
              <Copy size={14} className={isCopied ? 'text-green-400' : ''} />
            </button>
            
            <button 
              onClick={handleDownload}
              className="p-1.5 text-white/50 hover:text-white transition-colors bg-transparent border-none outline-none cursor-pointer"
              title="Baixar .md"
            >
              <Download size={14} />
            </button>

            <div className="w-px h-4 bg-white/10 mx-1"></div>
            
            <button 
              onClick={onClose}
              className="p-1.5 text-white/50 hover:text-white transition-colors bg-transparent border-none outline-none cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto no-scrollbar p-8">
          {isEditing ? (
            <textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              className="w-full h-full min-h-[500px] bg-transparent text-white/80 font-mono text-sm leading-relaxed outline-none border-none resize-none"
              placeholder="Edite o markdown aqui..."
              spellCheck={false}
            />
          ) : (
            <div className="prose prose-invert prose-sm max-w-none text-white/80 font-light leading-relaxed prose-headings:font-normal prose-headings:text-white prose-a:text-blue-400 hover:prose-a:text-blue-300 prose-strong:font-medium prose-strong:text-white">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {editedContent}
              </ReactMarkdown>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
