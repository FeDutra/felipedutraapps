import re

with open('src/apps/pulso/pages/LivePage.tsx', 'r') as f:
    content = f.read()

# 1. Add FileText to lucide-react import
content = content.replace("  Mic\n} from 'lucide-react';", "  Mic,\n  FileText\n} from 'lucide-react';")

# 2. Add MesaPanel import
if "MesaPanel" not in content:
    content = content.replace(
        "import { ArcaDrawer } from '../components/ArcaDrawer';",
        "import { ArcaDrawer } from '../components/ArcaDrawer';\nimport { MesaPanel, MesaArtifact } from '../components/MesaPanel';"
    )

# 3. Add isMesaOpen state (if not exists)
if "isMesaOpen" not in content:
    content = content.replace(
        "const [isArcaOpen, setIsArcaOpen] = React.useState(false);",
        "const [isArcaOpen, setIsArcaOpen] = React.useState(false);\n  const [isMesaOpen, setIsMesaOpen] = React.useState(false);\n  const [activeMesaArtifact, setActiveMesaArtifact] = React.useState<MesaArtifact | null>(null);"
    )

# 4. Wrap chat container with flex-row
chat_container_start = "          {(!isAtelieActive || showAtelieChatHistory) && ("
chat_container_replacement = """          {/* Mesa Panel (Split Screen) */}
          {isMesaOpen && activeMesaArtifact && (
            <div 
              className={`hidden md:block w-1/2 relative transition-all duration-300 ml-4`}
              style={{ height: chatHeight }}
            >
              <MesaPanel
                isOpen={isMesaOpen}
                onClose={() => setIsMesaOpen(false)}
                artifact={activeMesaArtifact}
                onSave={async (id, content) => {
                  setActiveMesaArtifact(prev => prev ? { ...prev, content } : null);
                  // Opcional: Aqui poderíamos salvar o markdown editado direto no Firebase Storage na Arca da sessão.
                  console.log('Salvar documento editado na Mesa:', id);
                }}
              />
            </div>
          )}

          {(!isAtelieActive || showAtelieChatHistory) && (
            <div className={`w-[90%] md:w-[75%] lg:w-[50%] 2xl:w-[75%] relative border-none shadow-none overflow-hidden pulso-transition flex-1 md:flex-none min-h-[120px] md:h-[60vh] md:max-h-[60vh] 2xl:max-h-[45vh] 2xl:h-[45vh] mt-2 mb-4 pointer-events-auto flex flex-row gap-4`}>
              
"""
if "flex flex-row gap-4" not in content:
    content = content.replace(chat_container_start, chat_container_replacement)

# 5. Fix chat container width class
chat_inner = """              className={`flex flex-col relative transition-all duration-300 ${
                isSidebarOpen ? 'ml-0 md:ml-64' : 'ml-0 md:ml-20'
              } ${
                isAtelieActive 
                  ? 'bg-black/55 backdrop-blur-xl border border-white/5 rounded-2xl p-4 shadow-2xl' 
                  : 'bg-transparent'
              }`}"""
chat_inner_replacement = """              className={`flex flex-col relative transition-all duration-300 ${
                isSidebarOpen ? 'ml-0 md:ml-64' : 'ml-0 md:ml-20'
              } ${
                isAtelieActive 
                  ? 'bg-black/55 backdrop-blur-xl border border-white/5 rounded-2xl p-4 shadow-2xl' 
                  : 'bg-transparent'
              } ${isMesaOpen ? 'w-full md:w-1/2' : 'w-full'}`}"""

if "isMesaOpen ? 'w-full md:w-1/2'" not in content:
    content = content.replace(chat_inner, chat_inner_replacement)

# 6. Add closing div for the new wrapper
closing_target = """            </div>
          )}

          {/* Arca Drawer (Overlaid) */}"""
closing_replacement = """            </div>
            </div>
          )}

          {/* Arca Drawer (Overlaid) */}"""
if "</div>\n            </div>\n          )}\n\n          {/* Arca Drawer (Overlaid) */}" not in content:
    content = content.replace(closing_target, closing_replacement)

# 7. Modify rendering of msg.text to parse pulso-doc
render_target = """                      {(!msg.attachments || msg.attachments.length === 0 || msg.text !== msg.attachments.map(a => a.name).join(', ')) && msg.text && (
                        <div className={`text-sm md:text-base leading-relaxed font-light text-[#fbf9f5]/90 block break-words ${!isLotus ? 'text-right' : 'text-left'}`} style={{ overflowWrap: 'anywhere' }}>
                          <MessageRenderer text={msg.text} sender={msg.sender} />
                        </div>
                      )}"""

render_replacement = """                      {(!msg.attachments || msg.attachments.length === 0 || msg.text !== msg.attachments.map(a => a.name).join(', ')) && msg.text && (
                        <div className={`text-sm md:text-base leading-relaxed font-light text-[#fbf9f5]/90 block break-words ${!isLotus ? 'text-right' : 'text-left'}`} style={{ overflowWrap: 'anywhere' }}>
                          {(() => {
                            const docRegex = /<pulso-doc\\s+id="([^"]+)"\\s+title="([^"]+)">([\\s\\S]*?)<\\/pulso-doc>/i;
                            const docMatch = msg.text.match(docRegex);
                            let displayText = msg.text;
                            let artifactData = null;
                            if (docMatch) {
                              artifactData = { id: docMatch[1], title: docMatch[2], content: docMatch[3].trim(), contextId: msg.contextId };
                              displayText = msg.text.replace(docRegex, '').trim();
                            }
                            
                            return (
                              <div className="flex flex-col gap-3">
                                {displayText && <MessageRenderer text={displayText} sender={msg.sender} />}
                                {artifactData && (
                                  <button
                                    onClick={() => {
                                      setActiveMesaArtifact(artifactData);
                                      setIsMesaOpen(true);
                                    }}
                                    className="flex items-center gap-2 px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all w-fit cursor-pointer outline-none group text-left"
                                  >
                                    <div className="p-2 bg-black/40 rounded-lg group-hover:bg-black/60 transition-colors">
                                      <FileText size={16} className="text-white/70" />
                                    </div>
                                    <div className="flex flex-col">
                                      <span className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">Documento Gerado</span>
                                      <span className="text-sm font-medium text-white">{artifactData.title}</span>
                                    </div>
                                  </button>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      )}"""

if "<pulso-doc" not in content:
    content = content.replace(render_target, render_replacement)

with open('src/apps/pulso/pages/LivePage.tsx', 'w') as f:
    f.write(content)
