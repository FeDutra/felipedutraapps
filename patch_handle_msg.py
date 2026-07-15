with open('src/apps/pulso/pages/LivePage.tsx', 'r') as f:
    content = f.read()

# We need to make sure originMode === 'recording_meeting' triggers forceOpenClaw
target1 = "if (originMode === 'text' || originMode === 'presence' || originMode === 'recording_once') {"
replacement1 = "if (originMode === 'text' || originMode === 'presence' || originMode === 'recording_once' || originMode === 'recording_meeting') {"

target2 = "if (originMode === 'presence' || originMode === 'recording_once') {"
replacement2 = "if (originMode === 'presence' || originMode === 'recording_once' || originMode === 'recording_meeting') {"

target3 = "const shouldForceOpenClaw = forceOpenClaw || (originMode === 'recording_once' && text.length > 50);"
replacement3 = "const shouldForceOpenClaw = forceOpenClaw || (originMode === 'recording_once' && text.length > 50) || originMode === 'recording_meeting';"

if target1 in content:
    content = content.replace(target1, replacement1)
if target2 in content:
    content = content.replace(target2, replacement2)
if target3 in content:
    content = content.replace(target3, replacement3)

with open('src/apps/pulso/pages/LivePage.tsx', 'w') as f:
    f.write(content)
