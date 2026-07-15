with open('src/apps/pulso/pages/LivePage.tsx', 'r') as f:
    content = f.read()

# I will add a small text at the top of the chat to prove the version is live!
target = """          <div className="flex flex-col items-center gap-2 mb-8 animate-fade-in">"""
replacement = """          <div className="flex flex-col items-center gap-2 mb-8 animate-fade-in">
            <span className="text-xs text-red-500">Mesa v4 Live</span>"""

if target in content:
    content = content.replace(target, replacement)
    with open('src/apps/pulso/pages/LivePage.tsx', 'w') as f:
        f.write(content)
    print("Injected debug text")
else:
    print("Target not found for debug text")

