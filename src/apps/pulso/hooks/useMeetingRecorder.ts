import { useState, useRef, useCallback, useEffect } from 'react';
import { storage } from '../../../shared/lib/firebase/client';
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

export interface MeetingChunkInfo {
  url: string;
  index: number;
  sessionId: string;
  sizeBytes: number;
  mimeType: string;
}

interface StopMeetingResult {
  sessionId: string;
  chunks: MeetingChunkInfo[];
}

// Five-minute chunks stay comfortably below provider and Storage limits.
const MEETING_CHUNK_DURATION_MS = 5 * 60 * 1000;

export function useMeetingRecorder(
  contextId: string,
  onChunkUploaded?: (chunk: MeetingChunkInfo, isFinal: boolean) => void,
) {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionIdRef = useRef('');
  const chunkIndexRef = useRef(0);
  const uploadedChunksRef = useRef<MeetingChunkInfo[]>([]);
  const pendingUploadsRef = useRef<Set<Promise<MeetingChunkInfo>>>(new Set());
  const uploadErrorRef = useRef<Error | null>(null);
  const isStoppingRef = useRef(false);

  const onChunkUploadedRef = useRef(onChunkUploaded);
  useEffect(() => {
    onChunkUploadedRef.current = onChunkUploaded;
  }, [onChunkUploaded]);

  const uploadChunk = useCallback((blob: Blob, index: number, isFinal: boolean) => {
    if (!storage) return Promise.reject(new Error('Firebase Storage indisponível.'));

    const sessionId = sessionIdRef.current;
    const extension = blob.type.includes('mp4') ? 'm4a' : 'webm';
    const filename = `meeting_${sessionId}_chunk_${index}.${extension}`;
    const target = storageRef(storage, `pulso/chats/${contextId}/arca/recordings/${sessionId}/${filename}`);

    const promise = new Promise<MeetingChunkInfo>((resolve, reject) => {
      const task = uploadBytesResumable(target, blob, { contentType: blob.type });
      task.on('state_changed', undefined, reject, async () => {
        try {
          const url = await getDownloadURL(target);
          const info: MeetingChunkInfo = {
            url,
            index,
            sessionId,
            sizeBytes: blob.size,
            mimeType: blob.type,
          };
          uploadedChunksRef.current.push(info);
          uploadedChunksRef.current.sort((a, b) => a.index - b.index);
          onChunkUploadedRef.current?.(info, isFinal);
          resolve(info);
        } catch (error) {
          reject(error);
        }
      });
    }).catch((error: unknown) => {
      const normalized = error instanceof Error ? error : new Error(String(error));
      uploadErrorRef.current = normalized;
      throw normalized;
    });

    pendingUploadsRef.current.add(promise);
    promise.finally(() => pendingUploadsRef.current.delete(promise)).catch(() => undefined);
    return promise;
  }, [contextId]);

  const startRecording = useCallback(async (): Promise<{ sessionId: string }> => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      throw new Error('Gravação de reunião não é suportada neste navegador.');
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;
    sessionIdRef.current = `meeting_${Date.now()}`;
    chunkIndexRef.current = 0;
    uploadedChunksRef.current = [];
    pendingUploadsRef.current.clear();
    uploadErrorRef.current = null;
    isStoppingRef.current = false;
    setIsRecording(true);

    const recordChunk = () => {
      if (!streamRef.current) return;
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/mp4';
      const recorder = new MediaRecorder(streamRef.current, { mimeType });
      mediaRecorderRef.current = recorder;
      const audioParts: Blob[] = [];

      recorder.ondataavailable = event => {
        if (event.data.size > 0) audioParts.push(event.data);
      };

      recorder.onstop = () => {
        if (audioParts.length === 0) return;
        const blob = new Blob(audioParts, { type: mimeType });
        const index = chunkIndexRef.current++;
        void uploadChunk(blob, index, isStoppingRef.current);
      };

      recorder.start(1000);
    };

    recordChunk();
    intervalRef.current = setInterval(() => {
      const recorder = mediaRecorderRef.current;
      if (recorder?.state !== 'recording') return;
      recorder.stop();
      if (!isStoppingRef.current) recordChunk();
    }, MEETING_CHUNK_DURATION_MS);

    return { sessionId: sessionIdRef.current };
  }, [uploadChunk]);

  const stopRecording = useCallback(async (): Promise<StopMeetingResult> => {
    isStoppingRef.current = true;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    const recorder = mediaRecorderRef.current;
    if (recorder?.state === 'recording') {
      await new Promise<void>(resolve => {
        const previousOnStop = recorder.onstop;
        recorder.onstop = event => {
          previousOnStop?.call(recorder, event);
          resolve();
        };
        recorder.stop();
      });
    }

    // onstop schedules the final upload synchronously; wait for every chunk,
    // including uploads that were still running from previous rotations.
    await Promise.allSettled([...pendingUploadsRef.current]);

    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    mediaRecorderRef.current = null;
    setIsRecording(false);

    if (uploadErrorRef.current) throw uploadErrorRef.current;
    if (uploadedChunksRef.current.length === 0) {
      throw new Error('Nenhum áudio foi capturado ou enviado.');
    }

    return {
      sessionId: sessionIdRef.current,
      chunks: [...uploadedChunksRef.current],
    };
  }, []);

  useEffect(() => () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    streamRef.current?.getTracks().forEach(track => track.stop());
  }, []);

  return { isRecording, startRecording, stopRecording };
}
