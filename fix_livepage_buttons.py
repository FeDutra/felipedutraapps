import re

with open('src/apps/pulso/pages/LivePage.tsx', 'r') as f:
    content = f.read()

# 1. Imports
if "import ArcaDrawer from '../components/ArcaDrawer';" not in content:
    import_match = re.search(r'import\s+.*?;', content)
    if import_match:
        content = content[:import_match.start()] + "import ArcaDrawer from '../components/ArcaDrawer';\n" + content[import_match.start():]

# 2. State
if "const [isArcaOpen, setIsArcaOpen] = useState(false);" not in content:
    state_match = re.search(r'const\s+\[isMesaOpen,\s*setIsMesaOpen\]\s*=\s*useState\(false\);', content)
    if not state_match:
        state_match = re.search(r'const\s+\[isAtelieActive,\s*setIsAtelieActive\]\s*=\s*useState\(false\);', content)
    if state_match:
        content = content[:state_match.end()] + "\n  const [isArcaOpen, setIsArcaOpen] = useState(false);" + content[state_match.end():]

# 3. Arca Drawer Render
if "<ArcaDrawer isOpen={isArcaOpen}" not in content:
    render_match = content.find("</main>")
    if render_match != -1:
        drawer_code = "\n      <ArcaDrawer isOpen={isArcaOpen} onClose={() => setIsArcaOpen(false)} contextId={activeContextNode?.contextId} />\n"
        content = content[:render_match+7] + drawer_code + content[render_match+7:]

# 4. Top Menu Button
arca_button = """<button 
            onClick={(e) => { 
              e.stopPropagation(); 
              setIsArcaOpen(!isArcaOpen); 
            }}
            className={`hidden md:flex text-xs font-light tracking-widest transition-all duration-300 items-center gap-1.5 lowercase bg-transparent border-none outline-none cursor-pointer ${
              isArcaOpen ? 'text-white font-bold drop-shadow-[0_0_8px_rgba(255,255,255,0.6)] animate-pulse' : 'text-[#fbf9f5]/80 hover:text-white'
            }`}
          >
            <span>[ arca ]</span>
          </button>"""

if "<span>[ arca ]</span>" not in content:
    atelie_btn = """<span>{isAtelieActive ? '[ chat ]' : '[ ateliê ]'}</span>
          </button>"""
    if atelie_btn in content:
        content = content.replace(atelie_btn, atelie_btn + "\n          " + arca_button)

# 5. Routing Button
old_btn = """<button
            onClick={() => setForceOpenClaw(!forceOpenClaw)}
            className={`p-1.5 transition-all duration-300 bg-transparent border-none cursor-pointer outline-none mb-0.5 ${forceOpenClaw ? 'opacity-100' : 'opacity-30 hover:opacity-100'}`}
            title="Forçar roteamento para OpenClaw (Raciocínio Profundo)"
          >
            <Circle size={10} strokeWidth={3} className="text-white" fill={forceOpenClaw ? "currentColor" : "none"} />
          </button>"""

new_btn = """<button
            onClick={() => setForceOpenClaw(!forceOpenClaw)}
            className={`font-mono text-xs transition-all duration-300 bg-transparent border-none cursor-pointer outline-none mb-0.5 tracking-[0.2em] flex items-center justify-center h-8 ${forceOpenClaw ? 'text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.4)] animate-pulse' : 'text-[#fbf9f5]/30 hover:text-white/60'}`}
            title="Forçar roteamento para OpenClaw (Raciocínio Profundo)"
          >
            {forceOpenClaw ? '( • )' : '(   )'}
          </button>"""

content = content.replace(old_btn, new_btn)

with open('src/apps/pulso/pages/LivePage.tsx', 'w') as f:
    f.write(content)
