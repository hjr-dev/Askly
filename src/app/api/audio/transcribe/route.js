import Groq from "groq-sdk";
import { getUserFromAuthorization } from "@/app/lib/subscriptions";

export const runtime = "nodejs";

const MAX_AUDIO_SIZE = 12 * 1024 * 1024;
const ALLOWED_AUDIO_TYPES = new Set([
  "audio/webm",
  "audio/mp4",
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/ogg",
]);

function getGroqClient() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    const error = new Error("Missing GROQ_API_KEY");
    error.status = 500;
    throw error;
  }
  return new Groq({ apiKey });
}

function errorResponse(err) {
  const status = err?.status || err?.statusCode || 500;
  console.error("GROQ TRANSCRIPTION ERROR:", {
    status,
    name: err?.name,
    message: err?.message,
    code: err?.code,
  });

  if (err?.message === "Missing GROQ_API_KEY") {
    return Response.json(
      { error: "Askly no tiene configurada la clave de Groq en el servidor." },
      { status: 500 }
    );
  }

  if (status === 401 || status === 403) {
    return Response.json(
      { error: "No se pudo autenticar la transcripción con Groq." },
      { status: 502 }
    );
  }

  if (status === 429) {
    return Response.json(
      { error: "Groq está limitando las transcripciones ahora mismo." },
      { status: 429 }
    );
  }

  return Response.json(
    { error: "No se pudo transcribir el audio. Inténtalo de nuevo." },
    { status: 502 }
  );
}

export async function POST(req) {
  const { error } = await getUserFromAuthorization(req);
  if (error) return Response.json({ error }, { status: 401 });

  try {
    const formData = await req.formData();
    const audio = formData.get("audio");

    if (!audio || typeof audio === "string") {
      return Response.json({ error: "No se recibió audio para transcribir." }, { status: 400 });
    }

    if (!audio.size) {
      return Response.json({ error: "La grabación está vacía." }, { status: 400 });
    }

    if (audio.size > MAX_AUDIO_SIZE) {
      return Response.json(
        { error: "La grabación es demasiado larga. Prueba con un audio más corto." },
        { status: 413 }
      );
    }

    if (audio.type && !ALLOWED_AUDIO_TYPES.has(audio.type)) {
      return Response.json(
        { error: "El formato de audio no es compatible con la transcripción." },
        { status: 400 }
      );
    }

    const groq = getGroqClient();
    const transcription = await groq.audio.transcriptions.create({
      file: audio,
      model: "whisper-large-v3-turbo",
      response_format: "json",
    });

    const text = transcription.text?.trim();
    if (!text) {
      return Response.json(
        { error: "No se detectó voz en la grabación." },
        { status: 422 }
      );
    }

    return Response.json({ text });
  } catch (err) {
    return errorResponse(err);
  }
}
