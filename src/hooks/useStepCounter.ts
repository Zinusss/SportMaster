import { useState, useEffect, useRef, useCallback } from 'react';

interface StepCounterHook {
  isSupported: boolean;
  isListening: boolean;
  permissionGranted: boolean;
  startListening: () => Promise<boolean>;
  stopListening: () => void;
  liveStepCount: number;
  resetLiveCount: () => void;
  error: string | null;
}

export function useStepCounter(onStepDetected?: (count: number) => void): StepCounterHook {
  const [isSupported, setIsSupported] = useState<boolean>(false);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [permissionGranted, setPermissionGranted] = useState<boolean>(false);
  const [liveStepCount, setLiveStepCount] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  const lastStepTimeRef = useRef<number>(0);
  const lastMagnitudeRef = useRef<number>(9.8);
  const isRisingRef = useRef<boolean>(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'DeviceMotionEvent' in window) {
      setIsSupported(true);
    }
  }, []);

  const handleMotion = useCallback((event: DeviceMotionEvent) => {
    const acc = event.accelerationIncludingGravity || event.acceleration;
    if (!acc || acc.x === null || acc.y === null || acc.z === null) return;

    const x = acc.x || 0;
    const y = acc.y || 0;
    const z = acc.z || 0;
    const magnitude = Math.sqrt(x * x + y * y + z * z);

    const now = Date.now();
    const STEP_THRESHOLD = 11.8; // m/s^2 peak threshold
    const MIN_STEP_INTERVAL = 300; // minimum ms between steps (max ~3 steps per second)

    // Simple peak detection
    if (magnitude > lastMagnitudeRef.current && magnitude > STEP_THRESHOLD) {
      isRisingRef.current = true;
    } else if (isRisingRef.current && magnitude < lastMagnitudeRef.current) {
      // Peak detected
      if (now - lastStepTimeRef.current > MIN_STEP_INTERVAL) {
        lastStepTimeRef.current = now;
        setLiveStepCount((prev) => {
          const next = prev + 1;
          if (onStepDetected) onStepDetected(next);
          return next;
        });
      }
      isRisingRef.current = false;
    }

    lastMagnitudeRef.current = magnitude;
  }, [onStepDetected]);

  const startListening = async (): Promise<boolean> => {
    setError(null);
    try {
      // iOS 13+ requires explicit permission request
      const deviceMotion = window.DeviceMotionEvent as any;
      if (typeof deviceMotion?.requestPermission === 'function') {
        const response = await deviceMotion.requestPermission();
        if (response !== 'granted') {
          setError('Доступ до сенсорів руху відхилено в налаштуваннях Safari.');
          return false;
        }
      }

      setPermissionGranted(true);
      window.addEventListener('devicemotion', handleMotion);
      setIsListening(true);
      return true;
    } catch (err: any) {
      console.error('Failed to start motion listener:', err);
      setError(err?.message || 'Помилка доступу до акселерометра');
      return false;
    }
  };

  const stopListening = () => {
    window.removeEventListener('devicemotion', handleMotion);
    setIsListening(false);
  };

  const resetLiveCount = () => {
    setLiveStepCount(0);
  };

  useEffect(() => {
    return () => {
      window.removeEventListener('devicemotion', handleMotion);
    };
  }, [handleMotion]);

  return {
    isSupported,
    isListening,
    permissionGranted,
    startListening,
    stopListening,
    liveStepCount,
    resetLiveCount,
    error
  };
}
