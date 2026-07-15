with open('src/apps/pulso/hooks/useMeetingRecorder.ts', 'r') as f:
    content = f.read()

target_stop = """  const stopRecording = useCallback(() => {
    isStoppingRef.current = true;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsRecording(false);
    return sessionIdRef.current;
  }, []);"""

new_stop = """  const stopRecording = useCallback(() => {
    return new Promise<{sessionId: string, finalChunkUrl?: string}>((resolve) => {
      isStoppingRef.current = true;
      let finalChunkUrl: string | undefined = undefined;
      
      const originalOnChunk = onChunkUploaded;
      
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        const recorder = mediaRecorderRef.current;
        const originalOnStop = recorder.onstop;
        
        recorder.onstop = async (e) => {
          if (originalOnStop) {
            // We need to wait for the original onstop to finish uploading
            // Actually, originalOnStop is an async function in our implementation.
            await (originalOnStop as Function)(e);
          }
          if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
          }
          setIsRecording(false);
          resolve({ sessionId: sessionIdRef.current });
        };
        recorder.stop();
      } else {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
        setIsRecording(false);
        resolve({ sessionId: sessionIdRef.current });
      }
    });
  }, [onChunkUploaded]);"""

if target_stop in content:
    content = content.replace(target_stop, new_stop)
    with open('src/apps/pulso/hooks/useMeetingRecorder.ts', 'w') as f:
        f.write(content)
