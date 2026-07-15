with open('src/apps/pulso/pages/LivePage.tsx', 'r') as f:
    content = f.read()

# I will find the exact index of `{(!isAtelieActive || showAtelieChatHistory) && (`
import re
start_pattern = r"\{\(\!isAtelieActive\s*\|\|\s*showAtelieChatHistory\)\s*\&\&\s*\("
match = re.search(start_pattern, content)
if match:
    start_idx = match.start()
    
    # We find the index of the closing div of the chat column.
    # It is right before `{/* Floating button to return to bottom */}`
    floating_btn_idx = content.find("{/* Floating button to return to bottom */}")
    
    # We need to find the matching closing parenthesis of `{(!isAtelieActive...)}`
    # We can just count braces from start_idx
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
    
    # block is the whole `{(!isAtelieActive...)}`
    block = content[start_idx:end_idx+1]
    
    # We want to replace the first two lines of the block:
    # {(!isAtelieActive || showAtelieChatHistory) && (
    #   <div className={`w-[90%] md:w-[75%] lg:w-[50%] 2xl:w-[75%] relative border-none shadow-none overflow-hidden pulso-transition flex-1 md:flex-none min-h-[120px] md:h-[60vh] md:max-h-[60vh] 2xl:max-h-[45vh] 2xl:h-[45vh] mt-2 mb-4 pointer-events-auto ${...}`}>
    
    # Let's find the first `onDragOver={...}`
    drag_start = block.find("onDragOver")
    first_div_start = block.find("<div")
    first_div_end = block.find(">", first_div_start)
    
    # The inner chat container starts right after the first <div ...>
    # Wait, the block actually has:
    # {(!isAtelieActive || showAtelieChatHistory) && (
    #   <div className="..." style="...">
    #     onDragOver={...}
    
    # Let's just find the first `style={{ height: chatHeight, marginBottom: chatMarginBottom }}`
    # Wait, that's ON the first div!
    style_idx = block.find("marginBottom: chatMarginBottom }}")
    first_div_end = block.find(">", style_idx)
    
    # So everything from first_div_end + 1 is the inner content!
    # BUT wait, the first div is closed at the very end of the block.
    # We will grab the inner content, which is from first_div_end + 1 down to the `</div>` before `)}`
    
    # The inner content:
    inner_content = block[first_div_end+1 : block.rfind("</div>")]
    
    # Now we construct the new block!
    new_block = """{(!isAtelieActive || showAtelieChatHistory) && (
        <div className={`w-[90%] md:w-[75%] lg:w-[50%] 2xl:w-[75%] relative border-none shadow-none overflow-hidden pulso-transition flex-1 md:flex-none min-h-[120px] md:h-[60vh] md:max-h-[60vh] 2xl:max-h-[45vh] 2xl:h-[45vh] mt-2 mb-4 pointer-events-auto flex flex-row gap-4 ${presenceMode ? 'pulso-hidden-center' : 'pulso-visible'}`}>
          
          <div 
            className={`flex flex-col relative transition-all duration-300 ${
              isAtelieActive 
                ? 'bg-black/55 backdrop-blur-xl border border-white/5 rounded-2xl p-4 shadow-2xl' 
                : 'bg-transparent'
            } ${isMesaOpen ? 'w-full md:w-1/2' : 'w-full'}`}
            style={{ height: chatHeight, marginBottom: chatMarginBottom }}
            """ + inner_content.lstrip() + """
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
    print("Success")
else:
    print("Not found")
