import re

with open('src/apps/pulso/pages/LivePage.tsx', 'r') as f:
    content = f.read()

# 1. Modify the `main` tag
target_main = "isAtelieActive ? 'overflow-hidden w-full h-full max-w-none mt-0 mb-0' : 'overflow-hidden max-w-5xl w-full mt-6 mb-4 pb-28'"
replacement_main = "isAtelieActive ? 'overflow-hidden w-full h-full max-w-none mt-0 mb-0' : `overflow-hidden ${isMesaOpen ? 'max-w-none w-1/2 ml-0' : 'max-w-5xl w-full mx-auto'} mt-6 mb-4 pb-28`"
if target_main in content:
    content = content.replace(target_main, replacement_main)
else:
    print("Warning: target_main not found")

# 2. Modify the Chat Wrapper width (so it uses full width of the 50vw main)
# It was: transition-all duration-500 ${isMesaOpen ? 'w-[95%] md:w-[95%] lg:w-[90%] 2xl:w-[85%]' : 'w-[90%] md:w-[75%] lg:w-[50%] 2xl:w-[75%]'}
target_chat_width = "className={`transition-all duration-500 ${isMesaOpen ? 'w-[95%] md:w-[95%] lg:w-[90%] 2xl:w-[85%]' : 'w-[90%] md:w-[75%] lg:w-[50%] 2xl:w-[75%]'} relative border-none shadow-none overflow-hidden pulso-transition flex-1 md:flex-none min-h-[120px] md:h-[60vh] md:max-h-[60vh] 2xl:max-h-[45vh] 2xl:h-[45vh] mt-2 mb-4 pointer-events-auto flex flex-row gap-4 ${presenceMode ? 'pulso-hidden-center' : 'pulso-visible'}`}"
replacement_chat_width = "className={`transition-all duration-500 ${isMesaOpen ? 'w-[95%] md:w-[95%] lg:w-[95%] 2xl:w-[95%]' : 'w-[90%] md:w-[75%] lg:w-[50%] 2xl:w-[75%]'} relative border-none shadow-none overflow-hidden pulso-transition flex-1 md:flex-none min-h-[120px] md:h-[60vh] md:max-h-[60vh] 2xl:max-h-[45vh] 2xl:h-[45vh] mt-2 mb-4 pointer-events-auto flex flex-row gap-4 ${presenceMode ? 'pulso-hidden-center' : 'pulso-visible'}`}"
if target_chat_width in content:
    content = content.replace(target_chat_width, replacement_chat_width)
else:
    print("Warning: target_chat_width not found")

# 3. Remove MesaPanel from inside the Chat Wrapper
mesa_panel_regex = re.compile(
    r"\{\/\*\s*Mesa Panel \(Split Screen\)\s*\*\/\}.*?\{\s*isMesaOpen && activeMesaArtifact && \(\s*<div\s*className=[^>]+>\s*<MesaPanel[^>]+/>\s*</div>\s*\)\}",
    re.DOTALL
)
if mesa_panel_regex.search(content):
    content = mesa_panel_regex.sub("", content)
else:
    print("Warning: MesaPanel not found in chat wrapper")

# 4. Inject MesaPanel at the root level, before the footer
# Find the footer:
footer_start = "<footer className={`fixed bottom-0"
global_mesa_panel = """
      {/* Mesa Panel (Split Screen) - Global Right Half */}
      {isMesaOpen && activeMesaArtifact && (
        <div className="fixed top-24 right-4 md:right-8 bottom-4 w-[calc(50vw-2rem)] md:w-[calc(50vw-3rem)] z-[60] animate-slide-in-right pointer-events-auto flex flex-col">
          <div className="w-full h-full rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.5)] overflow-hidden">
            <MesaPanel
              isOpen={isMesaOpen}
              onClose={() => setIsMesaOpen(false)}
              artifact={activeMesaArtifact}
            />
          </div>
        </div>
      )}

      """
if footer_start in content:
    content = content.replace(footer_start, global_mesa_panel + footer_start)
else:
    print("Warning: Footer not found")

# 5. Modify the Input Wrapper in Footer
target_input = '<div className="max-w-4xl mx-auto px-4 md:px-0 pointer-events-auto w-full relative">'
replacement_input = '<div className={`transition-all duration-500 px-4 md:px-0 pointer-events-auto w-full relative ${isMesaOpen ? "w-1/2 ml-0" : "max-w-4xl mx-auto"}`}>'
if target_input in content:
    content = content.replace(target_input, replacement_input)
else:
    print("Warning: target_input not found")

with open('src/apps/pulso/pages/LivePage.tsx', 'w') as f:
    f.write(content)
print("Layout patches applied")
