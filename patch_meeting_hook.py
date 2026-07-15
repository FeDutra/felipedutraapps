with open('src/apps/pulso/pages/LivePage.tsx', 'r') as f:
    content = f.read()

target = "const [voiceMode, setVoiceMode] = React.useState<VoiceMode>('off');"

hook_init = """const [voiceMode, setVoiceMode] = React.useState<VoiceMode>('off');
  
  // Meeting Recorder Hook
  const [meetingChunksUrls, setMeetingChunksUrls] = React.useState<string[]>([]);
  const { isRecording: isMeetingRecording, startRecording: startMeetingRec, stopRecording: stopMeetingRec, sessionId: meetingSessionId } = useMeetingRecorder(activeContextNode?.contextId || 'general', (chunk, isFinal) => {
    setMeetingChunksUrls(prev => [...prev, chunk.url]);
  });
"""

if target in content and "useMeetingRecorder(" not in content:
    content = content.replace(target, hook_init)
    with open('src/apps/pulso/pages/LivePage.tsx', 'w') as f:
        f.write(content)
