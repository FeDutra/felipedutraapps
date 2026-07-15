import re

with open('src/apps/pulso/pages/LivePage.tsx', 'r') as f:
    content = f.read()

# 1. Main container (w-1/2 when Mesa is open)
target_main = "isAtelieActive ? 'overflow-hidden w-full h-full max-w-none mt-0 mb-0' : 'overflow-hidden max-w-5xl w-full mt-6 mb-4 pb-28'"
replacement_main = "isAtelieActive ? 'overflow-hidden w-full h-full max-w-none mt-0 mb-0' : `overflow-hidden ${isMesaOpen ? 'max-w-[50vw] w-full ml-0 pr-4' : 'max-w-5xl w-full mx-auto'} mt-6 mb-4 pb-28`"
content = content.replace(target_main, replacement_main)

# 2. Chat wrapper width (take 100% of the half screen when open)
# The previous width was w-[95%] lg:w-[90%] 2xl:w-[85%]
# Let's just make it w-[100%] when Mesa is open!
target_chat = "className={`transition-all duration-500 ${isMesaOpen ? 'w-[95%] md:w-[95%] lg:w-[95%] 2xl:w-[95%]' : 'w-[90%] md:w-[75%] lg:w-[50%] 2xl:w-[75%]'} relative border-none shadow-none overflow-hidden pulso-transition flex-1 md:flex-none min-h-[120px] md:h-[60vh] md:max-h-[60vh] 2xl:max-h-[45vh] 2xl:h-[45vh] mt-2 mb-4 pointer-events-auto flex flex-row gap-4 ${presenceMode ? 'pulso-hidden-center' : 'pulso-visible'}`}"
replacement_chat = "className={`transition-all duration-500 ${isMesaOpen ? 'w-full px-4 md:px-8' : 'w-[90%] md:w-[75%] lg:w-[50%] 2xl:w-[75%]'} relative border-none shadow-none overflow-hidden pulso-transition flex-1 md:flex-none min-h-[120px] md:h-[60vh] md:max-h-[60vh] 2xl:max-h-[45vh] 2xl:h-[45vh] mt-2 mb-4 pointer-events-auto flex flex-col gap-4 ${presenceMode ? 'pulso-hidden-center' : 'pulso-visible'}`}"
# Notice I changed flex-row gap-4 to flex-col gap-4 for the wrapper, because the wrapper shouldn't hold MesaPanel anymore side by side
content = content.replace(target_chat, replacement_chat)

# Wait, if target_chat doesn't match because my previous script ran:
target_chat_old = "className={`transition-all duration-500 ${isMesaOpen ? 'w-[95%] md:w-[95%] lg:w-[90%] 2xl:w-[85%]' : 'w-[90%] md:w-[75%] lg:w-[50%] 2xl:w-[75%]'} relative border-none shadow-none overflow-hidden pulso-transition flex-1 md:flex-none min-h-[120px] md:h-[60vh] md:max-h-[60vh] 2xl:max-h-[45vh] 2xl:h-[45vh] mt-2 mb-4 pointer-events-auto flex flex-row gap-4 ${presenceMode ? 'pulso-hidden-center' : 'pulso-visible'}`}"
content = content.replace(target_chat_old, replacement_chat)


# 3. Footer position
target_footer = "<footer className={`absolute bottom-0 left-1/2 -translate-x-1/2 w-full max-w-xl flex flex-col items-center z-30 select-none pulso-transition max-h-[450px] gap-3 pb-6 md:pb-8 px-4 md:px-0 ${"
replacement_footer = "<footer className={`absolute bottom-0 ${isMesaOpen ? 'left-[25vw] -translate-x-1/2 w-[calc(50vw-2rem)]' : 'left-1/2 -translate-x-1/2 w-full max-w-xl'} flex flex-col items-center z-30 select-none pulso-transition max-h-[450px] gap-3 pb-6 md:pb-8 px-4 md:px-0 ${"
content = content.replace(target_footer, replacement_footer)


# 4. Remove MesaPanel from inside chat wrapper
mesa_panel_regex = re.compile(
    r"\{\/\*\s*Mesa Panel \(Split Screen\)\s*\*\/\}.*?\{\s*isMesaOpen && activeMesaArtifact && \(\s*<div\s*className=[^>]+>\s*<MesaPanel[^>]+/>\s*</div>\s*\)\}",
    re.DOTALL
)
content = mesa_panel_regex.sub("", content)

# 5. Inject MesaPanel at the very end of <main> before footer
injection = """
          {/* Mesa Panel (Split Screen) - Global Right Half */}
          {isMesaOpen && activeMesaArtifact && (
            <div className="fixed top-24 right-4 md:right-8 bottom-4 w-[calc(50vw-2rem)] md:w-[calc(50vw-3rem)] z-[60] animate-slide-in-right pointer-events-auto flex flex-col">
              <div className="w-full h-full rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.5)] overflow-hidden">
                <MesaPanel
                  isOpen={isMesaOpen}
                  onClose={() => setIsMesaOpen(false)}
                  artifact={activeMesaArtifact}
                  onSave={async (id, content) => {
                    setActiveMesaArtifact(prev => prev ? { ...prev, content } : null);
                  }}
                />
              </div>
            </div>
          )}
"""
footer_tag = "<footer className={`absolute bottom-0"
if footer_tag in content:
    content = content.replace(footer_tag, injection + "\n" + footer_tag)

with open('src/apps/pulso/pages/LivePage.tsx', 'w') as f:
    f.write(content)
print("Fix applied")
