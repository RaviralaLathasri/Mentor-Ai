import { useEffect, useRef, useState } from "react";

function withTimeout(promise, ms) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error("mic-timeout")), ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}

function downsampleBuffer(buffer, inputSampleRate, outputSampleRate) {
  if (outputSampleRate === inputSampleRate) return buffer;
  if (outputSampleRate > inputSampleRate) return buffer;

  const sampleRateRatio = inputSampleRate / outputSampleRate;
  const newLength = Math.round(buffer.length / sampleRateRatio);
  const result = new Float32Array(newLength);

  let offsetResult = 0;
  let offsetBuffer = 0;
  while (offsetResult < result.length) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
    let accum = 0;
    let count = 0;
    for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
      accum += buffer[i];
      count++;
    }
    result[offsetResult] = count ? accum / count : 0;
    offsetResult++;
    offsetBuffer = nextOffsetBuffer;
  }
  return result;
}

function floatTo16BitPCM(float32Array) {
  const buffer = new ArrayBuffer(float32Array.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < float32Array.length; i++) {
    let s = Math.max(-1, Math.min(1, float32Array[i]));
    // Scale to int16
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buffer;
}

export default function AudioRecorder({ wsRef, enabled, deviceId = "", onError }) {
  const [status, setStatus] = useState("idle");
  const [level, setLevel] = useState(0);

  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const processorRef = useRef(null);
  const sourceRef = useRef(null);
  const lastLevelUpdateRef = useRef(0);

  const stop = async () => {
    setStatus("idle");
    setLevel(0);
    try {
      if (processorRef.current) {
        processorRef.current.disconnect();
        processorRef.current.onaudioprocess = null;
        processorRef.current = null;
      }
      if (sourceRef.current) {
        sourceRef.current.disconnect();
        sourceRef.current = null;
      }
      if (audioContextRef.current) {
        await audioContextRef.current.close();
        audioContextRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    } catch {
      // ignore
    }
  };

  const start = async () => {
    const ws = wsRef?.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      onError?.("WebSocket is not connected.");
      return;
    }

    try {
      setStatus("requesting-mic");

      // If the browser exposes permissions, surface clear guidance when blocked.
      try {
        if (navigator?.permissions?.query) {
          const perm = await navigator.permissions.query({ name: "microphone" });
          if (perm?.state === "denied") {
            setStatus("idle");
            onError?.("Microphone is blocked for this site. Click the lock icon in the address bar, allow Microphone, then refresh.");
            return;
          }
        }
      } catch {
        // ignore (Permissions API not available)
      }

      const audioConstraints = {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      };
      if (deviceId) {
        audioConstraints.deviceId = { exact: deviceId };
      }

      let stream;
      try {
        // On some systems, the permission prompt can get "stuck" (user doesn't see it).
        // Show a better error after a short timeout instead of blinking forever.
        stream = await withTimeout(navigator.mediaDevices.getUserMedia({ audio: audioConstraints, video: false }), 12000);
      } catch (e) {
        // If the selected device can't be opened (common if unplugged), fall back to default.
        if (deviceId) {
          try {
            stream = await withTimeout(
              navigator.mediaDevices.getUserMedia({
                audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
                video: false,
              }),
              12000,
            );
            onError?.("Could not open the selected microphone. Using the default device instead.");
          } catch {
            throw e;
          }
        } else {
          throw e;
        }
      }
      streamRef.current = stream;

      setStatus("recording");
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const audioContext = new AudioCtx();
      audioContextRef.current = audioContext;
      try {
        // Some browsers start AudioContext in "suspended" until a user gesture; resume is safe regardless.
        await audioContext.resume();
      } catch {
        // ignore
      }

      const source = audioContext.createMediaStreamSource(stream);
      sourceRef.current = source;

      // ScriptProcessor is deprecated but remains broadly supported.
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (event) => {
        try {
          if (!wsRef?.current || wsRef.current.readyState !== WebSocket.OPEN) {
            return;
          }
          const input = event.inputBuffer.getChannelData(0);
          // Basic level meter (RMS). Rate-limit state updates to avoid re-rendering too often.
          let sum = 0;
          for (let i = 0; i < input.length; i++) {
            const v = input[i];
            sum += v * v;
          }
          const rms = Math.sqrt(sum / Math.max(1, input.length));
          const now = performance.now();
          if (now - lastLevelUpdateRef.current > 200) {
            lastLevelUpdateRef.current = now;
            setLevel(rms);
          }

          const downsampled = downsampleBuffer(input, audioContext.sampleRate, 16000);
          const pcm16 = floatTo16BitPCM(downsampled);
          wsRef.current.send(pcm16);
        } catch {
          // ignore transient audio errors
        }
      };

      source.connect(processor);
      processor.connect(audioContext.destination);
    } catch (e) {
      setStatus("idle");
      const name = e?.name || "";
      if (String(e?.message || "") === "mic-timeout") {
        onError?.("Microphone permission is pending. Check your browser address bar for the microphone allow/deny prompt, then click Allow and try again.");
      } else if (name === "NotAllowedError" || name === "SecurityError") {
        onError?.("Microphone permission denied. Allow microphone access for this site and refresh.");
      } else if (name === "NotFoundError") {
        onError?.("No microphone device found. Plug in a microphone or enable it in Windows Sound settings.");
      } else if (name === "NotReadableError") {
        onError?.("Microphone is busy/unavailable. Close other apps using the mic (Zoom/Teams/Recorder), then try again.");
      } else {
        onError?.("Microphone permission denied or unavailable.");
      }
    }
  };

  useEffect(() => {
    if (enabled) {
      start();
      return () => stop();
    }
    stop();
  }, [enabled, deviceId]);

  return (
    <div className="inline-status">
      <strong>Status:</strong> {status}
      {status === "recording" ? (
        <span className="muted" style={{ marginLeft: 10 }}>
          Level: {Math.round(Math.min(1, Math.max(0, level)) * 100)}%
        </span>
      ) : null}
    </div>
  );
}
