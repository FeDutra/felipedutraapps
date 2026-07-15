with open('src/apps/pulso/pages/LivePage.tsx', 'r') as f:
    content = f.read()

target = """<span className="text-[10px] font-bold tracking-widest text-white/50 uppercase">
                                        Documento Gerado
                                      </span>"""

replacement = """<span className="text-[10px] font-bold tracking-widest text-white/50 uppercase">
                                        Documento Gerado (Abrir Mesa)
                                      </span>"""

if target in content:
    content = content.replace(target, replacement)
    with open('src/apps/pulso/pages/LivePage.tsx', 'w') as f:
        f.write(content)
    print("Fixed button text successfully")
else:
    print("Target not found")
