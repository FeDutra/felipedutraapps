with open('src/apps/pulso/pages/LivePage.tsx', 'r') as f:
    content = f.read()

target = """          {(!isAtelieActive || showAtelieChatHistory) && (
            <div 
              className={`w-[90%] md:w-[75%] lg:w-[50%] 2xl:w-[75%] relative border-none shadow-none overflow-hidden pulso-transition flex-1 md:flex-none min-h-[120px] md:h-[60vh] md:max-h-[60vh] 2xl:max-h-[45vh] 2xl:h-[45vh] mt-2 mb-4 pointer-events-auto ${
                presenceMode ? 'pulso-hidden-center' : 'pulso-visible'
              } ${
                isAtelieActive 
                  ? 'bg-black/55 backdrop-blur-xl border border-white/5 rounded-2xl p-4 shadow-2xl' 
                  : 'bg-transparent'
              }`}
              style={{ height: chatHeight, marginBottom: chatMarginBottom }}
"""

replacement = """          {(!isAtelieActive || showAtelieChatHistory) && (
            <div className={`w-[90%] md:w-[75%] lg:w-[50%] 2xl:w-[75%] relative border-none shadow-none overflow-hidden pulso-transition flex-1 md:flex-none min-h-[120px] md:h-[60vh] md:max-h-[60vh] 2xl:max-h-[45vh] 2xl:h-[45vh] mt-2 mb-4 pointer-events-auto flex flex-row gap-4 ${presenceMode ? 'pulso-hidden-center' : 'pulso-visible'}`}>
              
              <div 
                className={`flex flex-col relative transition-all duration-300 ${
                  isAtelieActive 
                    ? 'bg-black/55 backdrop-blur-xl border border-white/5 rounded-2xl p-4 shadow-2xl' 
                    : 'bg-transparent'
                } ${isMesaOpen ? 'w-full md:w-1/2' : 'w-full'}`}
                style={{ height: chatHeight, marginBottom: chatMarginBottom }}
"""

target_end = """              {showScrollButton && !isAtelieActive && (
                <button 
                  onClick={scrollToBottom}
                  className="absolute bottom-6 left-1/2 transform -translate-x-1/2 p-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white/50 hover:text-white transition-all z-20 backdrop-blur-md"
                  aria-label="Rolar para o final"
                >
                  <ArrowDown size={16} />
                </button>
              )}
            </div>
          )}"""

replacement_end = """              {showScrollButton && !isAtelieActive && (
                <button 
                  onClick={scrollToBottom}
                  className="absolute bottom-6 left-1/2 transform -translate-x-1/2 p-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white/50 hover:text-white transition-all z-20 backdrop-blur-md"
                  aria-label="Rolar para o final"
                >
                  <ArrowDown size={16} />
                </button>
              )}
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

if target in content and target_end in content:
    content = content.replace(target, replacement)
    content = content.replace(target_end, replacement_end)
    with open('src/apps/pulso/pages/LivePage.tsx', 'w') as f:
        f.write(content)
    print("Success")
else:
    print("Not found")
