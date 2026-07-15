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

print("Target found:", target in content)
print("Target end found:", target_end in content)
