with open('src/apps/pulso/pages/LivePage.tsx', 'r') as f:
    content = f.read()

target = "  const toggleRecordingOnce = React.useCallback(async () => {"

new_func = """  const toggleMeetingRecording = React.useCallback(async () => {
    if (voiceModeRef.current === 'recording_meeting') {
      const sId = stopMeetingRec();
      setVoiceMode('off');
      voiceModeRef.current = 'off';
      
      console.log('[MEETING] Parando gravação da reunião. Enviando chunks para processamento...', meetingChunksUrls);
      
      if (meetingChunksUrls.length > 0) {
        try {
          // Exibir Toast de processamento
          const reqRes = await fetch('/api/pulso/process-meeting', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contextId: activeContextNode?.contextId || 'general',
              sessionId: sId || Date.now().toString(),
              chunkUrls: meetingChunksUrls
            })
          });
          
          if (!reqRes.ok) throw new Error('Falha ao processar reunião.');
          const data = await reqRes.json();
          
          if (data.transcription && data.summary) {
            console.log('[MEETING] Transcrição e resumo recebidos:', data);
            
            // Enviar para o Chat forçando o Deep Mode (OpenClaw)
            await handleSendMessage(`Reunião gravada e transcrita com sucesso. Aqui está o resumo e a transcrição. Por favor, crie um Plano de Ação detalhado com base nisso:\n\n**Resumo:**\n${data.summary}\n\n**Transcrição:**\n${data.transcription}`, {
              originMode: 'recording_meeting'
            });
          }
        } catch (error) {
          console.error('[MEETING] Erro no processamento:', error);
        }
      }
      setMeetingChunksUrls([]); // Resetar
      
    } else {
      setMeetingChunksUrls([]);
      await startMeetingRec();
      setVoiceMode('recording_meeting');
      voiceModeRef.current = 'recording_meeting';
    }
  }, [voiceMode, startMeetingRec, stopMeetingRec, meetingChunksUrls, activeContextNode, handleSendMessage]);

  const toggleRecordingOnce = React.useCallback(async () => {"""

if target in content and "toggleMeetingRecording" not in content:
    content = content.replace(target, new_func)
    with open('src/apps/pulso/pages/LivePage.tsx', 'w') as f:
        f.write(content)
