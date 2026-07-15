with open('src/apps/pulso/pages/LivePage.tsx', 'r') as f:
    content = f.read()

target = """          {/* Mesa Panel (Split Screen) */}
          {isMesaOpen && activeMesaArtifact && (
            <div 
              className={`block w-1/2 relative transition-all duration-300 bg-black/60 backdrop-blur-xl border border-white/5 rounded-2xl shadow-2xl overflow-hidden`}
              style={{ height: chatHeight }}
            >
              <MesaPanel"""

replacement = """          {/* Mesa Panel (Split Screen) */}
          {isMesaOpen && activeMesaArtifact && (
            <div 
              className={`flex flex-col w-1/2 relative transition-all duration-300 bg-black/60 backdrop-blur-xl border border-white/5 rounded-2xl shadow-2xl overflow-hidden`}
              style={{ height: chatHeight === 'auto' ? '100%' : chatHeight }}
            >
              <MesaPanel"""

if target in content:
    content = content.replace(target, replacement)
    with open('src/apps/pulso/pages/LivePage.tsx', 'w') as f:
        f.write(content)
    print("Fixed MesaPanel wrapper successfully")
else:
    print("Target not found")
