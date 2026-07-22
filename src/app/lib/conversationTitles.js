const DEFAULT_TITLE = "Nueva conversación";
const MAX_TITLE_WORDS = 5;
const MAX_TITLE_LENGTH = 60;

const FORBIDDEN_STARTERS = [
  "necesito",
  "quiero",
  "estoy",
  "ayudame",
  "ayúdame",
  "actua como",
  "actúa como",
  "puedes",
  "podrias",
  "podrías",
  "haz",
  "crea",
  "dame",
  "explica",
  "optimiza",
  "integra",
  "integrar",
  "desarrolla",
  "desarrollar",
];

const STOP_WORDS = new Set([
  "a",
  "al",
  "como",
  "con",
  "de",
  "del",
  "el",
  "en",
  "es",
  "esta",
  "este",
  "la",
  "las",
  "lo",
  "los",
  "mi",
  "mis",
  "para",
  "por",
  "que",
  "un",
  "una",
  "y",
]);

const PRESERVED_TERMS = new Map([
  ["api", "API"],
  ["app", "App"],
  ["checkout", "Checkout"],
  ["css", "CSS"],
  ["groq", "Groq"],
  ["ia", "IA"],
  ["javascript", "JavaScript"],
  ["next", "Next.js"],
  ["next.js", "Next.js"],
  ["qwen", "Qwen"],
  ["react", "React"],
  ["saas", "SaaS"],
  ["seo", "SEO"],
  ["stripe", "Stripe"],
  ["supabase", "Supabase"],
  ["ui", "UI"],
  ["ux", "UX"],
]);

function normalizeTitle(value) {
  return value
    .replace(/[\n\r\t]+/g, " ")
    .replace(/^["'“”‘’`*\s]+|["'“”‘’`*\s.]+$/g, "")
    .replace(/^\s*(titulo|título|title)\s*(breve|corto)?\s*:\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function stripForbiddenStarter(value) {
  let title = normalizeTitle(value);

  for (let i = 0; i < 2; i += 1) {
    const lower = title
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "");

    const starter = FORBIDDEN_STARTERS.find((item) => lower.startsWith(item));
    if (!starter) break;

    title = normalizeTitle(title.slice(starter.length).replace(/^[\s,.:;-]+/, ""));
  }

  return title;
}

function hasForbiddenStarter(value) {
  const lower = value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

  return FORBIDDEN_STARTERS.some((starter) => lower.startsWith(starter));
}

function limitWords(value) {
  return normalizeTitle(value).split(/\s+/).slice(0, MAX_TITLE_WORDS).join(" ");
}

function formatToken(token) {
  const normalized = token.toLowerCase();
  if (PRESERVED_TERMS.has(normalized)) return PRESERVED_TERMS.get(normalized);
  if (token.length <= 3 && token === token.toUpperCase()) return token;
  return `${normalized.charAt(0).toUpperCase()}${normalized.slice(1)}`;
}

function compactKeywordTitle(message) {
  const tokens =
    message.match(/[\p{L}\p{N}][\p{L}\p{N}.+#-]*/gu)?.filter((token) => {
      const normalized = token.toLowerCase();
      return normalized.length > 2 && !STOP_WORDS.has(normalized);
    }) || [];

  const uniqueTokens = [];
  for (const token of tokens) {
    const formatted = formatToken(token);
    if (!uniqueTokens.includes(formatted)) uniqueTokens.push(formatted);
    if (uniqueTokens.length === MAX_TITLE_WORDS) break;
  }

  return uniqueTokens.join(" ");
}

export function fallbackConversationTitle(firstMessage) {
  const message = typeof firstMessage === "string" ? firstMessage.trim() : "";
  if (!message) return DEFAULT_TITLE;

  const lower = message.toLowerCase();

  if (lower.includes("stripe")) return "Integración con Stripe";
  if (lower.includes("next.js") || lower.includes("nextjs") || lower.includes("next js")) {
    return "Optimización Next.js";
  }
  if (lower.includes("saas")) return "Arquitectura SaaS";
  if (lower.includes("supabase")) return "Integración con Supabase";
  if (lower.includes("pricing") || lower.includes("precio") || lower.includes("precios")) {
    return "Estrategia de Precios";
  }

  const stripped = stripForbiddenStarter(message);
  const compact = compactKeywordTitle(stripped);
  return sanitizeConversationTitle(compact, DEFAULT_TITLE);
}

export function legacyConversationTitle(firstMessage) {
  const message = typeof firstMessage === "string" ? firstMessage.trim() : "";
  const words = message.split(/\s+/).slice(0, 6);
  const title = words.join(" ");
  return title.length < message.length ? `${title}…` : title || DEFAULT_TITLE;
}

export function sanitizeConversationTitle(value, fallback = DEFAULT_TITLE) {
  const limited = limitWords(stripForbiddenStarter(String(value || ""))).slice(0, MAX_TITLE_LENGTH);
  const title = normalizeTitle(limited);

  if (!title || hasForbiddenStarter(title)) return fallback;
  return title;
}

export { DEFAULT_TITLE };
