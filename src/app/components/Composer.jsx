"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, FileText, Mic, Plus, Square, X } from "lucide-react";
import ModelDropdown from "@/app/components/ModelDropdown";
import { supabase } from "@/app/lib/supabase";

const MAX_HEIGHT_PX = 200;
const ACCEPTED_FILES = [
  ".txt",
  ".md",
  ".markdown",
  ".json",
  ".csv",
  ".pdf",
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".mjs",
  ".cjs",
  ".css",
  ".scss",
  ".html",
  ".xml",
  ".yml",
  ".yaml",
  ".toml",
  ".env",
  ".sql",
  ".py",
  ".rb",
  ".php",
  ".java",
  ".c",
  ".cc",
  ".cpp",
  ".h",
  ".hpp",
  ".cs",
  ".go",
  ".rs",
  ".swift",
  ".kt",
  ".sh",
  ".bash",
  ".zsh",
  ".fish",
  ".vue",
  ".svelte",
  ".doc",
  ".docx",
  ".rtf",
  "image/*",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
].join(",");

function formatFileSize(size) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function fileKey(file) {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

function preferredAudioType() {
  if (typeof MediaRecorder === "undefined") return "";
  if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) return "audio/webm;codecs=opus";
  if (MediaRecorder.isTypeSupported("audio/webm")) return "audio/webm";
  if (MediaRecorder.isTypeSupported("audio/mp4")) return "audio/mp4";
  return "";
}

export default function Composer({
  value,
  onChange,
  onSubmit,
  disabled,
  placeholder,
  spacious = false,
  maxWidthClass = "sm:w-[min(100%,820px)]",
}) {
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const [attachments, setAttachments] = useState([]);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [status, setStatus] = useState("");
  const canSubmit = !disabled && (value.trim() || attachments.length > 0);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT_PX)}px`;
  }, [value]);

  useEffect(() => {
    return () => {
      recorderRef.current?.state === "recording" && recorderRef.current.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (canSubmit) handleSubmit();
    }
  };

  const handleFiles = (selectedFiles) => {
    setStatus("");
    const incoming = Array.from(selectedFiles || []);
    if (!incoming.length) return;

    setAttachments((prev) => {
      const existing = new Set(prev.map(fileKey));
      const next = [...prev];

      for (const file of incoming) {
        if (existing.has(fileKey(file))) continue;
        next.push(file);
      }

      return next.slice(0, 5);
    });

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachment = (key) => {
    setAttachments((prev) => prev.filter((file) => fileKey(file) !== key));
  };

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit(attachments);
    setAttachments([]);
    setStatus("");
  };

  const stopTracks = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  const transcribeAudio = async (blob) => {
    if (!blob.size) {
      setStatus("No se detectó audio.");
      return;
    }

    setTranscribing(true);
    setStatus("Transcribiendo...");

    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        setStatus("Inicia sesión para transcribir audio.");
        return;
      }

      const formData = new FormData();
      const extension = blob.type.includes("mp4") ? "m4a" : "webm";
      formData.append("audio", blob, `askly-recording.${extension}`);

      const res = await fetch("/api/audio/transcribe", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${data.session.access_token}`,
        },
        body: formData,
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus(json.error || "No se pudo transcribir el audio.");
        return;
      }

      const transcription = json.text?.trim();
      if (!transcription) {
        setStatus("No se detectó voz en la grabación.");
        return;
      }

      onChange(value.trim() ? `${value.trim()}\n\n${transcription}` : transcription);
      setStatus("Transcripción añadida. Puedes revisarla antes de enviar.");
    } catch (err) {
      console.error(err);
      setStatus("No se pudo transcribir el audio.");
    } finally {
      setTranscribing(false);
    }
  };

  const startRecording = async () => {
    setStatus("");

    if (recording) {
      recorderRef.current?.stop();
      return;
    }

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setStatus("Tu navegador no permite grabar audio aquí.");
      return;
    }

    if (typeof MediaRecorder === "undefined") {
      setStatus("Tu navegador no soporta grabación de audio.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType = preferredAudioType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data?.size) chunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        setRecording(false);
        stopTracks();
        const audioType = recorder.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: audioType });
        chunksRef.current = [];
        transcribeAudio(blob);
      };

      recorder.start();
      setRecording(true);
      setStatus("Grabando...");
    } catch (err) {
      console.error(err);
      stopTracks();
      setRecording(false);
      setStatus(
        err?.name === "NotAllowedError"
          ? "Permiso de micrófono denegado."
          : "No se pudo iniciar la grabación."
      );
    }
  };

  const formHeightClass = spacious ? "min-h-[132px] sm:min-h-[146px]" : "min-h-[132px] sm:min-h-0";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit();
      }}
      className={`mx-auto flex w-[calc(100vw-32px)] max-w-none flex-col justify-between gap-3 rounded-[24px] border border-white/[0.055] bg-[var(--input)] px-5 py-5 shadow-[0_18px_45px_-38px_rgba(255,255,255,0.35)] transition-[border-color,background-color,opacity] duration-200 focus-within:border-white/[0.11] sm:px-6 ${maxWidthClass} ${formHeightClass}`}
    >
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {attachments.map((file) => {
            const key = fileKey(file);
            return (
              <span
                key={key}
                className="flex max-w-full items-center gap-2 rounded-full border border-white/[0.07] bg-white/[0.035] px-3 py-1.5 text-xs text-[var(--text-secondary)]"
              >
                <FileText className="size-3.5 shrink-0 text-[var(--accent)]/80" />
                <span className="max-w-[150px] truncate sm:max-w-[220px]">{file.name}</span>
                <span className="shrink-0 text-[10px] text-[var(--text-secondary)]/75">
                  {formatFileSize(file.size)}
                </span>
                <button
                  type="button"
                  onClick={() => removeAttachment(key)}
                  aria-label={`Quitar archivo ${file.name}`}
                  className="grid size-5 shrink-0 place-items-center rounded-full text-[var(--text-secondary)] transition-colors hover:bg-white/[0.06] hover:text-[var(--foreground)]"
                >
                  <X className="size-3" />
                </button>
              </span>
            );
          })}
        </div>
      )}

      <textarea
        ref={textareaRef}
        rows={1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={placeholder || "¿En qué puedo ayudarte hoy?"}
        className="max-h-[200px] min-h-[64px] w-full resize-none bg-transparent text-base leading-7 text-[var(--foreground)] placeholder:text-[var(--text-secondary)] focus:outline-none disabled:opacity-50 sm:min-h-[48px]"
      />

      {status && (
        <div
          role="status"
          className="flex items-center gap-2 text-xs text-[var(--text-secondary)]"
        >
          {recording && (
            <span className="size-2 rounded-full bg-[var(--accent)] motion-safe:animate-[askly-blink_1s_step-end_infinite]" />
          )}
          {status}
        </div>
      )}

      <div className="flex items-center justify-between">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPTED_FILES}
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <button
          type="button"
          disabled={disabled}
          title="Adjuntar archivo"
          aria-label="Adjuntar archivo"
          onClick={() => fileInputRef.current?.click()}
          className="grid size-9 shrink-0 place-items-center rounded-full border border-[var(--input-border)] text-[var(--text-secondary)] transition-colors duration-200 hover:bg-white/[0.04] hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus className="size-4" />
        </button>

        <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
          <ModelDropdown />
          <button
            type="button"
            onClick={startRecording}
            disabled={disabled || transcribing}
            aria-label={recording ? "Detener grabación" : "Grabar voz"}
            title={recording ? "Detener grabación" : "Grabar voz"}
            className={`grid size-9 shrink-0 place-items-center rounded-full border border-[var(--input-border)] transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-40 ${
              recording
                ? "bg-[var(--accent)]/12 text-[var(--accent)]"
                : "text-[var(--text-secondary)] hover:bg-white/[0.04] hover:text-[var(--foreground)]"
            }`}
          >
            {recording ? <Square className="size-3.5" /> : <Mic className="size-4" />}
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            aria-label="Enviar"
            className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--accent)] text-[var(--on-accent)] transition-colors duration-200 hover:bg-[var(--accent-hover)] disabled:opacity-40"
          >
            <ArrowUp className="size-4" />
          </button>
        </div>
      </div>
    </form>
  );
}
