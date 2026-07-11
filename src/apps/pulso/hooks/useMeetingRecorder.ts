import { useState, useRef, useCallback } from 'react';
import { storage } from '../../../shared/lib/firebase/client';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';

export interface MeetingChunkInfo {
  url: string;
  index: number;
  sessionId: string;
}

export function useMeetingRecorder(contextId: string, onChunkUploaded?: (chunk: MeetingChunkInfo, isFinal: boolean) => void) {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunkIndexRef = useRef(0);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const sessionIdRef = useRef<string>('');
  const isStoppingRef = useRef(false);

  // Fatiar a cada 15 minutos para evitar o limite de 25MB do Groq e perdas de memória
  const CHUNK_DURATION_MS = 15 * 60 * 1000;

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      sessionIdRef.current = Date.now().toString();
      chunkIndexRef.current = 0;
      isStoppingRef.current = false;
      setIsRecording(true);

      const recordChunk = () => {
        if (!streamRef.current) return;
        const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
        const recorder = new MediaRecorder(streamRef.current, { mimeType });
        mediaRecorderRef.current = recorder;

        let audioChunks: Blob[] = [];

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunks.push(e.data);
        };

        recorder.onstop = async () => {
          if (audioChunks.length > 0) {
            const blob = new Blob(audioChunks, { type: mimeType });
            const currentIndex = chunkIndexRef.current++;
            const filename = `meeting_${sessionIdRef.current}_chunk_${currentIndex}.webm`;
            const isFinal = isStoppingRef.current;
            
            try {
              const sRef = storageRef(storage, `pulso/chats/${contextId}/arca/recordings/${sessionIdRef.current}/${filename}`);
              await uploadBytes(sRef, blob);
              const url = await getDownloadURL(sRef);
              if (onChunkUploaded) {
                onChunkUploaded({ url, index: currentIndex, sessionId: sessionIdRef.current }, isFinal);
              }
            } catch (err) {
              console.error("[MeetingRecorder] Erro no upload do chunk da reunião:", err);
            }
          }
        };

        recorder.start();
      };

      recordChunk();

      intervalRef.current = setInterval(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.stop(); 
          if (!isStoppingRef.current) {
            recordChunk(); 
          }
        }
      }, CHUNK_DURATION_MS);

    } catch (err) {
      console.error("[MeetingRecorder] Erro ao acessar microfone:", err);
      setIsRecording(false);
    }
  }, [contextId, onChunkUploaded]);

  const stopRecording = useCallback(() => {
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
  }, []);

  return { isRecording, startRecording, stopRecording, sessionId: sessionIdRef.current };
}
