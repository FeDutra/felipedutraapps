with open('src/apps/pulso/pages/LivePage.tsx', 'r') as f:
    content = f.read()

target = "className={`w-[90%] md:w-[75%] lg:w-[50%] 2xl:w-[75%] relative border-none shadow-none overflow-hidden pulso-transition flex-1 md:flex-none min-h-[120px] md:h-[60vh] md:max-h-[60vh] 2xl:max-h-[45vh] 2xl:h-[45vh] mt-2 mb-4 pointer-events-auto flex flex-row gap-4 ${presenceMode ? 'pulso-hidden-center' : 'pulso-visible'}`}"

replacement = "className={`transition-all duration-500 ${isMesaOpen ? 'w-[95%] md:w-[95%] lg:w-[90%] 2xl:w-[85%]' : 'w-[90%] md:w-[75%] lg:w-[50%] 2xl:w-[75%]'} relative border-none shadow-none overflow-hidden pulso-transition flex-1 md:flex-none min-h-[120px] md:h-[60vh] md:max-h-[60vh] 2xl:max-h-[45vh] 2xl:h-[45vh] mt-2 mb-4 pointer-events-auto flex flex-row gap-4 ${presenceMode ? 'pulso-hidden-center' : 'pulso-visible'}`}"

if target in content:
    content = content.replace(target, replacement)
    with open('src/apps/pulso/pages/LivePage.tsx', 'w') as f:
        f.write(content)
    print("Fixed Mesa wrapper width successfully")
else:
    print("Target not found")
