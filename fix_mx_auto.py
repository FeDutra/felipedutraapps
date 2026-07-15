with open('src/apps/pulso/pages/LivePage.tsx', 'r') as f:
    content = f.read()

target = "isMesaOpen ? 'max-w-[50vw] w-full pl-16 md:pl-28 pr-4' : 'max-w-5xl w-full mx-auto'"
replacement = "isMesaOpen ? 'max-w-[50vw] w-full !ml-0 !mr-auto pl-16 md:pl-28 pr-4' : 'max-w-5xl w-full mx-auto'"

if target in content:
    content = content.replace(target, replacement)
    with open('src/apps/pulso/pages/LivePage.tsx', 'w') as f:
        f.write(content)
    print("Fixed mx-auto override")
else:
    print("Target string not found in main container")
