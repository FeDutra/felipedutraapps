import React, { useEffect, useState } from 'react';
import { X, FileText, Headphones, Download, Archive, Loader2 } from 'lucide-react';
import { storage } from '../../../shared/lib/firebase/client';
import { ref as storageRef, listAll, getDownloadURL, getMetadata, StorageReference } from 'firebase/storage';

interface ArcaFile {
  name: string;
  url: string;
  type: 'document' | 'audio' | 'other';
  size: number;
  timeCreated: string;
}

interface ArcaDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  contextId: string;
}

export default function ArcaDrawer({ isOpen, onClose, contextId }: ArcaDrawerProps) {
  const [files, setFiles] = useState<ArcaFile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen || !contextId) return;

    let isMounted = true;
    setLoading(true);

    const fetchFiles = async () => {
      try {
        const arcaDocsRef = storageRef(storage, `pulso/chats/${contextId}/arca/docs`);
        const arcaRecordingsRef = storageRef(storage, `pulso/chats/${contextId}/arca/recordings`);

        const getAllFiles = async (folderRef: StorageReference) => {
          let allFiles: StorageReference[] = [];
          try {
            const result = await listAll(folderRef);
            allFiles = [...result.items];
            for (const prefix of result.prefixes) {
              const subResult = await getAllFiles(prefix);
              allFiles = [...allFiles, ...subResult];
            }
          } catch (e) {
            // Folder might not exist
          }
          return allFiles;
        };

        const [docsFiles, recordingsFiles] = await Promise.all([
          getAllFiles(arcaDocsRef),
          getAllFiles(arcaRecordingsRef),
        ]);

        const allRefs = [...docsFiles, ...recordingsFiles];
        
        const filesData: ArcaFile[] = await Promise.all(
          allRefs.map(async (ref) => {
            const url = await getDownloadURL(ref);
            const metadata = await getMetadata(ref);
            const isAudio = metadata.contentType?.includes('audio') || ref.name.endsWith('.webm') || ref.name.endsWith('.m4a');
            const isDoc = metadata.contentType?.includes('markdown') || metadata.contentType?.includes('text') || ref.name.endsWith('.md');
            
            return {
              name: ref.name,
              url,
              type: isAudio ? 'audio' : isDoc ? 'document' : 'other',
              size: metadata.size,
              timeCreated: metadata.timeCreated
            };
          })
        );

        // Sort descending by creation time
        filesData.sort((a, b) => new Date(b.timeCreated).getTime() - new Date(a.timeCreated).getTime());

        if (isMounted) {
          setFiles(filesData);
          setLoading(false);
        }
      } catch (err) {
        console.error("Erro ao carregar arquivos da Arca:", err);
        if (isMounted) setLoading(false);
      }
    };

    fetchFiles();

    return () => {
      isMounted = false;
    };
  }, [isOpen, contextId]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop Etereo */}
      <div 
        className="fixed inset-0 z-50 transition-opacity duration-500 ease-in-out cursor-pointer"
        style={{
          background: 'radial-gradient(circle at center, transparent 0%, rgba(0,0,0,0.4) 100%)',
          backdropFilter: 'blur(2px)'
        }}
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div 
        className="fixed top-0 right-0 h-full w-[90%] md:w-[400px] z-[60] flex flex-col pointer-events-auto transform transition-transform duration-700 ease-out translate-x-0"
        style={{
          background: 'transparent',
          backdropFilter: 'blur(16px) saturate(180%)',
          WebkitBackdropFilter: 'blur(16px) saturate(180%)',
          borderLeft: 'none',
        }}
      >
        <div className="flex items-center justify-between p-8 pb-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-[#fbf9f5]/90 text-lg font-light tracking-wide flex items-center gap-2">
              <Archive size={16} strokeWidth={1.5} className="text-[#fbf9f5]/60" />
              A Arca
            </h2>
            <span className="text-[10px] text-[#fbf9f5]/40 font-mono tracking-widest uppercase">Drive Etéreo</span>
          </div>
          <button 
            onClick={onClose}
            className="p-2 -mr-2 bg-transparent border-none outline-none cursor-pointer text-[#fbf9f5]/40 hover:text-[#fbf9f5] transition-colors"
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden p-8 pt-4 custom-scrollbar">
          {loading ? (
            <div className="w-full h-full flex flex-col items-center justify-center opacity-50">
              <Loader2 size={24} className="animate-spin text-[#fbf9f5]/30 mb-4" />
              <span className="text-[10px] tracking-widest uppercase text-[#fbf9f5]/40 font-mono">Resgatando memórias...</span>
            </div>
          ) : files.length === 0 ? (
            <div className="w-full h-full flex flex-col items-center justify-center text-center px-4">
              <Archive size={32} strokeWidth={1} className="text-[#fbf9f5]/10 mb-4" />
              <p className="text-[#fbf9f5]/40 font-light text-sm">A Arca está vazia.</p>
              <p className="text-[#fbf9f5]/20 text-[10px] font-mono tracking-wide mt-2">Nenhum arquivo gravado nesta sessão ainda.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {files.map((file, idx) => (
                <div 
                  key={idx}
                  className="group relative w-full flex items-center justify-between py-3 border-b border-white/5 transition-all duration-300"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-8 h-8 flex items-center justify-center transition-colors shrink-0">
                      {file.type === 'audio' ? (
                        <Headphones size={14} strokeWidth={1.2} className="text-[#fbf9f5]/50 group-hover:text-[#fbf9f5]/80" />
                      ) : (
                        <FileText size={14} strokeWidth={1.2} className="text-[#fbf9f5]/50 group-hover:text-[#fbf9f5]/80" />
                      )}
                    </div>
                    <div className="flex flex-col min-w-0 pr-4">
                      <span className="text-[#fbf9f5]/80 text-sm font-light truncate">
                        {file.name.replace(/_/g, ' ')}
                      </span>
                      <div className="flex items-center gap-2 text-[10px] text-[#fbf9f5]/30 font-mono mt-0.5">
                        <span>{new Date(file.timeCreated).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</span>
                        <span>•</span>
                        <span>{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                      </div>
                    </div>
                  </div>
                  
                  <a 
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-[#fbf9f5]/40 hover:text-[#fbf9f5] flex items-center justify-center"
                    title="Baixar Arquivo"
                  >
                    <Download size={14} strokeWidth={1.5} />
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
