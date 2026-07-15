with open('src/apps/pulso/pages/LivePage.tsx', 'r') as f:
    content = f.read()

target = "isMesaOpen ? 'max-w-none w-1/2 ml-0' : 'max-w-5xl w-full mx-auto'"
replacement = "isMesaOpen ? 'max-w-[50vw] w-full pl-16 md:pl-28 pr-4' : 'max-w-5xl w-full mx-auto'"

if target in content:
    content = content.replace(target, replacement)
    with open('src/apps/pulso/pages/LivePage.tsx', 'w') as f:
        f.write(content)
    print("Fixed left margin for sidebar")
else:
    print("Target string not found in main container")

# What about the input footer?
# It was: left-[25vw] -translate-x-1/2 w-[calc(50vw-2rem)]
# If we shift the left content rightward because of the sidebar, the input should also shift.
# The sidebar is on the left. The chat is centered in the remaining space of the left half.
# But for now, fixing the main padding should visually balance the chat.
