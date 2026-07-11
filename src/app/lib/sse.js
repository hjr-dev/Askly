// Parseo compartido de una línea SSE de Gemini (`data: {...}`), usado tanto
// en el cliente (hooks/useAskly.js) como en el servidor
// (api/conversations/messages/route.js, para acumular la respuesta completa
// y persistirla) — evita mantener la misma lógica de parseo dos veces.
export function extractTextFromSSELine(line) {
  if (!line.startsWith("data: ")) return null;
  const json = line.slice(6).trim();
  if (!json) return null;
  try {
    const parsed = JSON.parse(json);
    return parsed.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  } catch {
    return null;
  }
}
