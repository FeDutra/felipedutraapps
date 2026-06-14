const fs = require('fs');
const file = 'src/apps/pulso/pages/LivePage.tsx';
let code = fs.readFileSync(file, 'utf8');

// 1. Add refs to LivePage
code = code.replace(
  "  const [copiedPackageId, setCopiedPackageId] = React.useState<string | null>(null);",
  "  const [copiedPackageId, setCopiedPackageId] = React.useState<string | null>(null);\n  const voiceReplyRequestsRef = React.useRef<Set<string>>(new Set());\n  const currentTextRef = React.useRef<string>('');"
);

// 2. Update onSnapshot
const onSnapshotOld = `            const hasOpenClawResponse = !!req.openclawResult?.responseText;
            const replyText = hasOpenClawResponse
              ? req.openclawResult.responseText
              : (req.status === 'queued_for_openclaw' || req.status === 'processing_by_openclaw'
                 ? ''
                 : (req.interpretation?.suggestedReply || 
                    \`Registrei o comando "\${req.summary || req.title}" para processamento operacional.\`));`;

const onSnapshotNew = `            const hasOpenClawResponse = !!req.openclawResult?.responseText;
            const replyText = hasOpenClawResponse
              ? req.openclawResult.responseText
              : (req.status === 'queued_for_openclaw' || req.status === 'processing_by_openclaw'
                 ? ''
                 : (req.interpretation?.suggestedReply || 
                    \`Registrei o comando "\${req.summary || req.title}" para processamento operacional.\`));
            
            if (hasOpenClawResponse && voiceReplyRequestsRef.current.has(req.id)) {
              voiceReplyRequestsRef.current.delete(req.id);
              if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
                const utterance = new SpeechSynthesisUtterance(req.openclawResult.responseText);
                utterance.lang = 'pt-BR';
                window.speechSynthesis.speak(utterance);
              }
            }`;

code = code.replace(onSnapshotOld, onSnapshotNew);

// 3. Update handleSendMessage signature and first lines
const handleSendOld = `  const handleSendMessage = async (textToSend?: string) => {
    const rawMsg = textToSend || inputMessage;
    if (!rawMsg.trim()) return;

    setInputMessage('');`;

const handleSendNew = `  const handleSendMessage = async (textToSend?: string, options?: { requestVoiceReply?: boolean }) => {
    const rawMsg = textToSend || inputMessage;
    if (!rawMsg.trim()) return;

    setInputMessage('');
    currentTextRef.current = '';`;

code = code.replace(handleSendOld, handleSendNew);

// 4. Update handleSendMessage reqId insertion
const reqIdOld = `      const newRequest = await lotusOpenClawClient.queueRequest(lotusPayload);

      if (state) {`;

const reqIdNew = `      const newRequest = await lotusOpenClawClient.queueRequest(lotusPayload);
      
      if (options?.requestVoiceReply) {
        voiceReplyRequestsRef.current.add(reqId);
      }

      if (state) {`;

code = code.replace(reqIdOld, reqIdNew);

// 5. Update startVoiceInput toggle logic
const startVoiceOld = `    if (voiceState === 'listening') {
      stopVoiceRecognition();
      setVoiceState('idle');
      return;
    }

    finalTranscriptRef.current = '';`;

const startVoiceNew = `    if (voiceState === 'listening') {
      const textToSend = currentTextRef.current.trim();
      stopVoiceRecognition();
      setVoiceState('idle');
      if (textToSend) {
        handleSendMessage(textToSend, { requestVoiceReply: false });
      }
      return;
    }

    finalTranscriptRef.current = '';
    currentTextRef.current = '';`;

code = code.replace(startVoiceOld, startVoiceNew);

// 6. Update recognition.onresult
const onresultOld = `      const currentText = (finalTranscriptRef.current + ' ' + interimTranscript)
        .trim()
        .replace(/\\s+/g, ' ');

      setInputMessage(currentText);

      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
      }

      silenceTimeoutRef.current = setTimeout(() => {
        const textToSend = finalTranscriptRef.current.trim().replace(/\\s+/g, ' ');
        if (textToSend) {
          stopVoiceRecognition();
          setVoiceState('idle');
        }
      }, 2200);`;

const onresultNew = `      const currentText = (finalTranscriptRef.current + ' ' + interimTranscript)
        .trim()
        .replace(/\\s+/g, ' ');

      currentTextRef.current = currentText;
      setInputMessage(currentText);

      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
      }

      silenceTimeoutRef.current = setTimeout(() => {
        const textToSend = currentTextRef.current.trim();
        if (textToSend) {
          stopVoiceRecognition();
          setVoiceState('idle');
          handleSendMessage(textToSend, { requestVoiceReply: true });
        }
      }, 2500);`;

code = code.replace(onresultOld, onresultNew);

// 7. Update Lotus circle click to start voice input
const circleOld = `        <div 
          onClick={(e) => { 
            if (!presenceMode) {
              e.stopPropagation(); 
              setPresenceMode(true); 
            }
          }}`;

const circleNew = `        <div 
          onClick={(e) => { 
            if (!presenceMode) {
              e.stopPropagation(); 
              setPresenceMode(true); 
            }
            if (voiceState !== 'listening') {
              startVoiceInput();
            }
          }}`;

code = code.replace(circleOld, circleNew);

fs.writeFileSync(file, code);
console.log('Voice integration patched!');
