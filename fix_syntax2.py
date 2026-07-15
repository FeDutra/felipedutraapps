with open('src/apps/pulso/pages/LivePage.tsx', 'r') as f:
    content = f.read()

target = """            </button>
          )}
        </div>
      )}

        <div className={`fixed bottom-8 left-1/2 -translate-x-1/2"""

replacement = """            </button>
          )}
        </div>

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
              }}
            />
          </div>
        )}
      </div>
      )}

        <div className={`fixed bottom-8 left-1/2 -translate-x-1/2"""

content = content.replace(target, replacement)

with open('src/apps/pulso/pages/LivePage.tsx', 'w') as f:
    f.write(content)
