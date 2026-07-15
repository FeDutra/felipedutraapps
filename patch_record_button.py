import re

with open('src/apps/pulso/pages/LivePage.tsx', 'r') as f:
    content = f.read()

# Add the Record Meeting button next to the (  ) button
routing_btn = """<button
            onClick={() => setForceOpenClaw(!forceOpenClaw)}
            className={`font-mono text-xs transition-all duration-300 bg-transparent border-none cursor-pointer outline-none mb-0.5 tracking-[0.2em] flex items-center justify-center h-8 ${forceOpenClaw ? 'text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.4)] animate-pulse' : 'text-[#fbf9f5]/30 hover:text-white/60'}`}
            title="Forçar roteamento para OpenClaw (Raciocínio Profundo)"
          >
            {forceOpenClaw ? '( • )' : '(   )'}
          </button>"""

record_btn = """<button
            onClick={toggleRecordingOnce}
            className={`p-1.5 transition-all duration-300 bg-transparent border-none cursor-pointer outline-none mb-0.5 ${voiceMode === 'recording_once' ? 'opacity-100 drop-shadow-[0_0_8px_rgba(184,40,62,0.6)] animate-pulse' : 'opacity-30 hover:opacity-100'}`}
            title="Gravar Reunião"
          >
            <Circle size={10} strokeWidth={3} className={voiceMode === 'recording_once' ? "text-[#b8283e]" : "text-[#fbf9f5]"} fill={voiceMode === 'recording_once' ? "currentColor" : "none"} />
          </button>"""

if 'title="Gravar Reunião"' not in content:
    content = content.replace(routing_btn, record_btn + "\n          " + routing_btn)

with open('src/apps/pulso/pages/LivePage.tsx', 'w') as f:
    f.write(content)
