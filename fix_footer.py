with open('src/apps/pulso/pages/LivePage.tsx', 'r') as f:
    content = f.read()

target = "<footer className={`absolute bottom-0 ${isMesaOpen ? 'left-[25vw] -translate-x-1/2 w-[calc(50vw-2rem)]' : 'left-1/2 -translate-x-1/2 w-full max-w-xl'} flex flex-col items-center z-30 select-none pulso-transition max-h-[450px] gap-3 pb-6 md:pb-8 px-4 md:px-0 ${"
replacement = "<footer className={`absolute bottom-0 ${isMesaOpen ? 'left-0 w-[50vw] pl-16 md:pl-28 pr-4' : 'left-1/2 -translate-x-1/2 w-full max-w-xl'} flex flex-col items-center z-30 select-none pulso-transition max-h-[450px] gap-3 pb-6 md:pb-8 px-4 md:px-0 ${"

if target in content:
    content = content.replace(target, replacement)
    with open('src/apps/pulso/pages/LivePage.tsx', 'w') as f:
        f.write(content)
    print("Fixed footer alignment")
else:
    print("Target string not found in footer")
