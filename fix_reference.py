with open('src/apps/pulso/pages/LivePage.tsx', 'r') as f:
    content = f.read()

target1 = "console.log('[MEETING] Parando gravação da reunião. Enviando chunks para processamento...', meetingChunksUrls);"
replacement1 = "console.log('[MEETING] Parando gravação da reunião. Enviando chunks para processamento...', finalUrls);"

target2 = "}, [voiceMode, startMeetingRec, stopMeetingRec, meetingChunksUrls, activeContextNode, handleSendMessage]);"
replacement2 = "}, [voiceMode, startMeetingRec, stopMeetingRec, activeContextNode, handleSendMessage]);"

if target1 in content:
    content = content.replace(target1, replacement1)
if target2 in content:
    content = content.replace(target2, replacement2)

with open('src/apps/pulso/pages/LivePage.tsx', 'w') as f:
    f.write(content)
