import { useRef, useEffect, useCallback } from 'react';

export function useAudioPlayer() {
  const queueRef = useRef<Blob[]>([]);
  const isPlayingRef = useRef<boolean>(false);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Initialize context on first user interaction required by browsers
  const initAudio = useCallback(() => {
    if (!audioContextRef.current) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioContextRef.current = new AudioCtx();
    }
  }, []);

  const decodeAndPlay = async (blob: Blob) => {
    if (!audioContextRef.current) return;
    
    try {
      const arrayBuffer = await blob.arrayBuffer();
      const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
      
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);
      
      source.onended = () => {
        // Play next chunk in queue
        if (queueRef.current.length > 0) {
          const nextBlob = queueRef.current.shift();
          if (nextBlob) decodeAndPlay(nextBlob);
        } else {
          isPlayingRef.current = false;
        }
      };
      
      source.start();
    } catch {
      console.error("Audio playback error");
      if (queueRef.current.length > 0) {
        const nextBlob = queueRef.current.shift();
        if (nextBlob) decodeAndPlay(nextBlob);
      } else {
        isPlayingRef.current = false;
      }
    }
  };

  const enqueueAudio = useCallback((blob: Blob) => {
    initAudio();
    if (!isPlayingRef.current) {
      isPlayingRef.current = true;
      decodeAndPlay(blob);
    } else {
      queueRef.current.push(blob);
    }
  }, [initAudio]);

  // Cleanup
  useEffect(() => {
    return () => {
      audioContextRef.current?.close();
    };
  }, []);

  return { enqueueAudio, initAudio };
}
