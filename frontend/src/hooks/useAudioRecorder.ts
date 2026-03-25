import { useState, useRef, useCallback } from 'react';

export function useAudioRecorder(onDataAvailable: (blob: Blob) => void) {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startRecording = useCallback(async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Browser does not support microphone access or you are not in a secure context (HTTPS/localhost).");
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const options = { mimeType: 'audio/webm;codecs=opus' };
      const mediaRecorder = MediaRecorder.isTypeSupported(options.mimeType) 
        ? new MediaRecorder(stream, options)
        : new MediaRecorder(stream); // fallback to browser default
        
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          onDataAvailable(e.data);
        }
      };

      // Record in chunks of 500ms for near real-time streaming
      mediaRecorder.start(500);
      setIsRecording(true);
    } catch (err) {
      console.error("Microphone access error:", err);
      const msg = err instanceof Error ? err.message : "Access denied.";
      alert(`Microphone Error: ${msg}\n\nPlease ensure you have allowed microphone access and are using a secure connection.`);
    }
  }, [onDataAvailable]);

  const stopRecording = useCallback(async () => {
    const recorder = mediaRecorderRef.current;

    if (recorder && recorder.state === 'recording') {
      await new Promise<void>((resolve) => {
        recorder.addEventListener('stop', () => resolve(), { once: true });
        recorder.stop();
      });
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }

    setIsRecording(false);
  }, []);

  return {
    isRecording,
    startRecording,
    stopRecording
  };
}
