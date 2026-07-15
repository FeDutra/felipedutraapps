with open('src/apps/pulso/pages/LivePage.tsx', 'r') as f:
    content = f.read()

# We want MesaPanel INSIDE the `flex flex-row gap-4` container.
# Currently it's above it.
# Let's remove it from above and place it right after the chat container (which is inside the flex-row).

wrong_mesa_block = """          {/* Mesa Panel (Split Screen) */}
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

"""
content = content.replace(wrong_mesa_block, "")

# The chat container ends with:
#             </div>
#             </div>
#           )}
# Let's inject MesaPanel before the last `</div>` of the flex container.

target = """              </div>
            </div>
          )}"""

replacement = """              </div>

              {/* Mesa Panel (Split Screen) */}
              {isMesaOpen && activeMesaArtifact && (
                <div 
                  className={`hidden md:block w-1/2 relative transition-all duration-300 ml-4 bg-black/60 backdrop-blur-xl border border-white/5 rounded-2xl shadow-2xl overflow-hidden`}
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
            </div>
          )}"""

if "bg-black/60 backdrop-blur-xl border border-white/5" not in content:
    content = content.replace(target, replacement)

with open('src/apps/pulso/pages/LivePage.tsx', 'w') as f:
    f.write(content)
