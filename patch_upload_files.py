with open('src/apps/pulso/pages/LivePage.tsx', 'r') as f:
    content = f.read()

target = """          if (data.transcription && data.summary) {
            console.log('[MEETING] Transcrição e resumo recebidos:', data);
            
            // Enviar para o Chat forçando o Deep Mode (OpenClaw)
            await handleSendMessage(`Reunião gravada e transcrita com sucesso. Aqui está o resumo e a transcrição. Por favor, crie um Plano de Ação detalhado com base nisso:\\n\\n**Resumo:**\\n${data.summary}\\n\\n**Transcrição:**\\n${data.transcription}`, {
              originMode: 'recording_meeting'
            });
          }"""

replacement = """          if (data.transcription && data.summary) {
            console.log('[MEETING] Transcrição e resumo recebidos:', data);
            
            try {
              // Salvar os dois arquivos na ARCA via Storage
              const tsBlob = new Blob([data.transcription], { type: 'text/markdown' });
              const sumBlob = new Blob([data.summary], { type: 'text/markdown' });
              
              const tsFileName = `transcricao_${sId}.md`;
              const sumFileName = `resumo_${sId}.md`;
              const cId = activeContextNode?.contextId || 'general';
              
              const tsRef = storageRef(storage, `pulso/chats/${cId}/arca/files/${tsFileName}`);
              const sumRef = storageRef(storage, `pulso/chats/${cId}/arca/files/${sumFileName}`);
              
              await uploadBytes(tsRef, tsBlob);
              await uploadBytes(sumRef, sumBlob);
              
              console.log('[MEETING] Arquivos salvos na ARCA com sucesso.');
              
              // Enviar para o Chat forçando o Deep Mode (OpenClaw) e referenciando os arquivos gerados
              await handleSendMessage(`Reunião gravada e processada. Os arquivos **${tsFileName}** e **${sumFileName}** foram salvos na ARCA do projeto.\\n\\nAbaixo estão os conteúdos:\\n\\n**Resumo:**\\n${data.summary}\\n\\n**Transcrição:**\\n${data.transcription}\\n\\nPor favor, atue no modo profundo e crie um **Plano de Ação** detalhado na Mesa com base nesses dados.`, {
                originMode: 'recording_meeting'
              });
            } catch (uploadErr) {
              console.error('[MEETING] Erro ao subir os arquivos pra ARCA:', uploadErr);
              // Fallback se o upload falhar, ainda pede o plano de ação
              await handleSendMessage(`Reunião gravada e transcrita com sucesso. Aqui está o resumo e a transcrição. Por favor, crie um Plano de Ação detalhado com base nisso:\\n\\n**Resumo:**\\n${data.summary}\\n\\n**Transcrição:**\\n${data.transcription}`, {
                originMode: 'recording_meeting'
              });
            }
          }"""

if target in content:
    content = content.replace(target, replacement)
    with open('src/apps/pulso/pages/LivePage.tsx', 'w') as f:
        f.write(content)
