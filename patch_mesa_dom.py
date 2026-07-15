import re

with open('src/apps/pulso/pages/LivePage.tsx', 'r') as f:
    content = f.read()

# 1. State
state_match = re.search(r'const\s+\[isAtelieActive,\s*setIsAtelieActive\]\s*=\s*React\.useState\(false\);', content)
if state_match and "const [isMesaOpen" not in content:
    state_injection = "\n  const [isMesaOpen, setIsMesaOpen] = React.useState(false);\n  const [activeMesaArtifact, setActiveMesaArtifact] = React.useState<{id: string, title: string, content: string, contextId?: string} | null>(null);\n"
    content = content[:state_match.end()] + state_injection + content[state_match.end():]

# 2. DOM Rewriting
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
            
            floating_button_idx = block.find("{showScrollButton", div_end)
            floating_button_block = ""
            if floating_button_idx != -1:
                btn_end = block.find("</button>", floating_button_idx)
                if btn_end != -1:
                    btn_full_end = block.find(")}", btn_end) + 2
                    floating_button_block = block[floating_button_idx:btn_full_end]
            
            new_block = """{(!isAtelieActive || showAtelieChatHistory) && (
            <div className={`w-[90%] md:w-[75%] lg:w-[50%] 2xl:w-[75%] relative border-none shadow-none overflow-hidden pulso-transition flex-1 md:flex-none min-h-[120px] md:h-[60vh] md:max-h-[60vh] 2xl:max-h-[45vh] 2xl:h-[45vh] mt-2 mb-4 pointer-events-auto flex flex-row gap-4 ${presenceMode ? 'pulso-hidden-center' : 'pulso-visible'}`}>
              
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
