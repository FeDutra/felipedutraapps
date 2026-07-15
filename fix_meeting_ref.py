with open('src/apps/pulso/pages/LivePage.tsx', 'r') as f:
    content = f.read()

target1 = """  // Meeting Recorder Hook
  const [meetingChunksUrls, setMeetingChunksUrls] = React.useState<string[]>([]);
  const { isRecording: isMeetingRecording, startRecording: startMeetingRec, stopRecording: stopMeetingRec, sessionId: meetingSessionId } = useMeetingRecorder(activeContextNode?.contextId || 'general', (chunk, isFinal) => {
    setMeetingChunksUrls(prev => [...prev, chunk.url]);
  });"""

replacement1 = """  // Meeting Recorder Hook
  const meetingChunksUrlsRef = React.useRef<string[]>([]);
  const { isRecording: isMeetingRecording, startRecording: startMeetingRec, stopRecording: stopMeetingRec, sessionId: meetingSessionId } = useMeetingRecorder(activeContextNode?.contextId || 'general', (chunk, isFinal) => {
    meetingChunksUrlsRef.current.push(chunk.url);
  });"""

target2 = """      const sId = stopMeetingRec();"""
replacement2 = """      const { sessionId: sId } = await stopMeetingRec();
      const finalUrls = [...meetingChunksUrlsRef.current];"""

target3 = """chunkUrls: meetingChunksUrls"""
replacement3 = """chunkUrls: finalUrls"""

target4 = """if (meetingChunksUrls.length > 0) {"""
replacement4 = """if (finalUrls.length > 0) {"""

target5 = """setMeetingChunksUrls([]); // Resetar"""
replacement5 = """meetingChunksUrlsRef.current = []; // Resetar"""

target6 = """setMeetingChunksUrls([]);
      await startMeetingRec();"""
replacement6 = """meetingChunksUrlsRef.current = [];
      await startMeetingRec();"""

content = content.replace(target1, replacement1)
content = content.replace(target2, replacement2)
content = content.replace(target3, replacement3)
content = content.replace(target4, replacement4)
content = content.replace(target5, replacement5)
content = content.replace(target6, replacement6)

with open('src/apps/pulso/pages/LivePage.tsx', 'w') as f:
    f.write(content)
