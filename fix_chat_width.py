with open('src/apps/pulso/pages/LivePage.tsx', 'r') as f:
    content = f.read()

target = "${isMesaOpen ? 'w-full w-1/2' : 'w-full'}"
replacement = "${isMesaOpen ? 'w-full' : 'w-full'}"
if target in content:
    content = content.replace(target, replacement)
    with open('src/apps/pulso/pages/LivePage.tsx', 'w') as f:
        f.write(content)
    print("Fixed inner chat width")
else:
    print("Target not found")
