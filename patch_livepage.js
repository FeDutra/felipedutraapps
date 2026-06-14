const fs = require('fs');
const file = 'src/apps/pulso/pages/LivePage.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  "  Paperclip\n} from 'lucide-react';",
  "  Paperclip,\n  FileText,\n  Image as ImageIcon,\n  Camera\n} from 'lucide-react';"
);

code = code.replace(
  "const [showAttachmentToast, setShowAttachmentToast] = React.useState(false);",
  "const [showAttachmentToast, setShowAttachmentToast] = React.useState(false);\n  const [isAttachmentMenuOpen, setIsAttachmentMenuOpen] = React.useState(false);\n  const attachmentMenuRef = React.useRef<HTMLDivElement>(null);\n\n  React.useEffect(() => {\n    const handleClickOutside = (event: MouseEvent) => {\n      if (attachmentMenuRef.current && !attachmentMenuRef.current.contains(event.target as Node)) {\n        setIsAttachmentMenuOpen(false);\n      }\n    };\n    document.addEventListener('mousedown', handleClickOutside);\n    return () => document.removeEventListener('mousedown', handleClickOutside);\n  }, []);"
);

const attachmentUI = `
          {/* Menu de Anexos */}
          <div className="relative" ref={attachmentMenuRef}>
            <button
              onClick={() => setIsAttachmentMenuOpen(!isAttachmentMenuOpen)}
              className="p-1.5 text-[#fbf9f5]/60 hover:text-white transition-colors bg-transparent border-none cursor-pointer outline-none mb-0.5"
              title="Anexar arquivos"
            >
              <Paperclip size={14} strokeWidth={1.5} />
            </button>
            
            {/* Popover do Menu */}
            <div className={\`absolute bottom-full left-0 mb-2 w-36 bg-black/40 backdrop-blur-md border border-white/10 rounded-xl overflow-hidden pulso-transition \${
              isAttachmentMenuOpen ? 'opacity-100 transform translate-y-0 pointer-events-auto scale-100' : 'opacity-0 transform translate-y-2 pointer-events-none scale-95'
            }\`}>
              <div className="flex flex-col text-xs font-light tracking-wide text-[#fbf9f5]">
                <button 
                  onClick={() => { setShowAttachmentToast(true); setIsAttachmentMenuOpen(false); setTimeout(() => setShowAttachmentToast(false), 3000); }}
                  className="flex items-center gap-2 px-4 py-2.5 hover:bg-white/10 transition-colors text-left border-b border-white/5 bg-transparent"
                >
                  <FileText size={12} />
                  <span>arquivos</span>
                </button>
                <button 
                  onClick={() => { setShowAttachmentToast(true); setIsAttachmentMenuOpen(false); setTimeout(() => setShowAttachmentToast(false), 3000); }}
                  className="flex items-center gap-2 px-4 py-2.5 hover:bg-white/10 transition-colors text-left border-b border-white/5 bg-transparent"
                >
                  <ImageIcon size={12} />
                  <span>fotos</span>
                </button>
                <button 
                  onClick={() => { setShowAttachmentToast(true); setIsAttachmentMenuOpen(false); setTimeout(() => setShowAttachmentToast(false), 3000); }}
                  className="flex items-center gap-2 px-4 py-2.5 hover:bg-white/10 transition-colors text-left bg-transparent"
                >
                  <Camera size={12} />
                  <span>câmera</span>
                </button>
              </div>
            </div>
          </div>
`;

code = code.replace(
  '<div className="w-full flex items-end gap-3.5 bg-transparent border-b border-white/20 focus-within:border-white transition-colors py-2 px-1 relative">',
  '<div className="w-full flex items-end gap-3.5 bg-transparent border-b border-white/20 focus-within:border-white transition-colors py-2 px-1 relative">\n' + attachmentUI
);

fs.writeFileSync(file, code);
console.log('LivePage attachment menu patched!');
