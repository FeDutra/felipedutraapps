import re

with open('src/apps/pulso/pages/LivePage.tsx', 'r') as f:
    content = f.read()

# 1. Imports
if "import MesaPanel" not in content:
    import_match = re.search(r'import\s+.*?;', content)
    if import_match:
        content = content[:import_match.start()] + "import { MesaPanel } from '../components/MesaPanel';\n" + content[import_match.start():]

# 2. State
if "const [isMesaOpen" not in content:
    state_match = re.search(r'const\s+\[isAtelieActive,\s*setIsAtelieActive\]\s*=\s*useState\(false\);', content)
    if state_match:
        state_injection = "\n  const [isMesaOpen, setIsMesaOpen] = useState(false);\n  const [activeMesaArtifact, setActiveMesaArtifact] = useState<{id: string, title: string, content: string, contextId?: string} | null>(null);\n"
        content = content[:state_match.end()] + state_injection + content[state_match.end():]

# 3. Message Renderer
msg_render_target = """{(!msg.attachments || msg.attachments.length === 0 || msg.text !== msg.attachments.map(a => a.name).join(', ')) && msg.text && (
                        <div className={`text-sm md:text-base leading-relaxed font-light text-[#fbf9f5]/90 block break-words ${!isLotus ? 'text-right' : 'text-left'}`} style={{ overflowWrap: 'anywhere' }}>
                          <MessageRenderer text={msg.text} sender={msg.sender} />
                        </div>
                      )}"""

msg_render_replacement = """{(!msg.attachments || msg.attachments.length === 0 || msg.text !== msg.attachments.map(a => a.name).join(', ')) && msg.text && (
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

content = content.replace(msg_render_target, msg_render_replacement)

# 4. AST rewriting for ChatCol and MesaPanel
start_pattern = r"\{\(\!isAtelieActive\s*\|\|\s*showAtelieChatHistory\)\s*\&\&\s*\("
match = re.search(start_pattern, content)
if match:
    start_idx = match.start()
    depth = 0
    end_idx = -1
    in_string = False
    string_char = ''

    for i in range(start_idx, len(content)):
        c = content[i]
        if in_string:
            if c == string_char and content[i-1] != '\\':
                in_string = False
        else:
            if c in ["'", '"', '`']:
                in_string = True
                string_char = c
            elif c == '{':
                depth += 1
            elif c == '}':
                depth -= 1
                if depth == 0:
                    end_idx = i
                    break
    
    if end_idx != -1:
        block = content[start_idx:end_idx+1]
        
        # Original wrapper we want to strip the first part of
        # It looks like:
        # {(!isAtelieActive || showAtelieChatHistory) && (
        #     <div className={`w-[90%] md:w-[75%] lg:w-[50%] ...
        
        drag_start = block.find("onDragOver")
        div_start = block.rfind("<div", 0, drag_start)
        
        div_depth = 0
        div_end = -1
        div_iter = re.finditer(r"<\/?div\b", block[div_start:])
        for m in div_iter:
            if m.group(0) == "<div":
                div_depth += 1
            else:
                div_depth -= 1
                if div_depth == 0:
                    div_end = div_start + m.end() + 1
                    break
        
        if div_end != -1:
            chat_col_inner = block[drag_start:div_end]
            
            # The floating button comes AFTER div_end in the original block
            floating_button_idx = block.find("{showScrollButton", div_end)
            floating_button_block = ""
            if floating_button_idx != -1:
                # Find matching closing brace for this button logic
                # Just take from floating_button_idx to end of block minus the trailing `</div>\n          )}`
                # Let's cleanly just grab the button logic:
                btn_end = block.find("</button>", floating_button_idx)
                if btn_end != -1:
                    btn_full_end = block.find(")}", btn_end) + 2
                    floating_button_block = block[floating_button_idx:btn_full_end]
            
            new_block = """{(!isAtelieActive || showAtelieChatHistory) && (
            <div className={`w-[90%] md:w-[75%] lg:w-[50%] 2xl:w-[75%] relative border-none shadow-none overflow-hidden pulso-transition flex-1 md:flex-none min-h-[120px] md:h-[60vh] md:max-h-[60vh] 2xl:max-h-[45vh] 2xl:h-[45vh] mt-2 mb-4 pointer-events-auto flex flex-row gap-4`}>
              
              <div 
                className={`flex flex-col relative transition-all duration-300 ${
                  isAtelieActive 
                    ? 'bg-black/55 backdrop-blur-xl border border-white/5 rounded-2xl p-4 shadow-2xl' 
                    : 'bg-transparent'
                } ${isMesaOpen ? 'w-full md:w-1/2' : 'w-full'}`}
                style={{ height: chatHeight, marginBottom: chatMarginBottom }}
                """ + chat_col_inner + """
                
                {/* Floating button */}
                """ + floating_button_block + """
              </div>

              {/* Mesa Panel (Split Screen) */}
              {isMesaOpen && activeMesaArtifact && (
                <div 
                  className={`hidden md:block w-1/2 relative transition-all duration-300 bg-black/60 backdrop-blur-xl border border-white/5 rounded-2xl shadow-2xl overflow-hidden`}
                  style={{ height: chatHeight }}
                >
                  <MesaPanel
                    isOpen={isMesaOpen}
                    onClose={() => setIsMesaOpen(false)}
                    artifact={activeMesaArtifact}
                    onSave={async (id, content) => {
                      setActiveMesaArtifact(prev => prev ? { ...prev, content } : null);
                    }}
                  />
                </div>
              )}
            </div>
          )}"""
            
            content = content[:start_idx] + new_block + content[end_idx+1:]

with open('src/apps/pulso/pages/LivePage.tsx', 'w') as f:
    f.write(content)

