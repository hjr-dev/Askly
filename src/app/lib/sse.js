export function encodeSSE(payload) {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

export function parseSSELine(line) {
  if (!line.startsWith("data: ")) return null;
  const json = line.slice(6).trim();
  if (!json) return null;
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function tagPrefixAtEnd(value, tag) {
  const lower = value.toLowerCase();
  const max = Math.min(lower.length, tag.length - 1);
  for (let size = max; size > 0; size -= 1) {
    if (lower.endsWith(tag.slice(0, size))) return size;
  }
  return 0;
}

function readTag(value, index, tagName, closing = false) {
  const lower = value.toLowerCase();
  const start = closing ? `</${tagName}` : `<${tagName}`;
  if (!lower.startsWith(start, index)) return null;

  const next = lower[index + start.length];
  if (next && next !== ">" && !/\s/.test(next)) return null;

  const end = lower.indexOf(">", index + start.length);
  if (end === -1) return { complete: false };
  return { complete: true, end };
}

function updateFenceState(state, value, index) {
  if (!state.atLineStart) return;
  const match = value.slice(index).match(/^[ \t]*```/);
  if (match) state.inCodeFence = !state.inCodeFence;
}

function createThinkTagFilterState() {
  return {
    pending: "",
    inThink: false,
    inCodeFence: false,
    atLineStart: true,
  };
}

export function createThinkTagFilter() {
  const state = createThinkTagFilterState();

  return {
    process(chunk) {
      if (!chunk) return "";

      const value = state.pending + chunk;
      state.pending = "";
      let output = "";
      let i = 0;

      while (i < value.length) {
        const rest = value.slice(i);
        const lowerRest = rest.toLowerCase();

        if (!state.inCodeFence) {
          if (state.inThink) {
            const closing = readTag(value, i, "think", true);
            if (closing?.complete) {
              state.inThink = false;
              i = closing.end + 1;
              continue;
            }
            if (closing && !closing.complete) {
              state.pending = rest;
              break;
            }
            const pendingClose = tagPrefixAtEnd(rest, "</think");
            if (pendingClose === rest.length && rest.startsWith("<")) {
              state.pending = rest;
              break;
            }
            i += 1;
            continue;
          }

          const opening = readTag(value, i, "think");
          if (opening?.complete) {
            state.inThink = true;
            i = opening.end + 1;
            continue;
          }
          if (opening && !opening.complete) {
            state.pending = rest;
            break;
          }

          if (lowerRest.startsWith("<")) {
            const pendingOpenSize = tagPrefixAtEnd(rest, "<think");
            const pendingCloseSize = tagPrefixAtEnd(rest, "</think");
            if (
              (pendingOpenSize === rest.length && "<think".startsWith(lowerRest)) ||
              (pendingCloseSize === rest.length && "</think".startsWith(lowerRest))
            ) {
              state.pending = rest;
              break;
            }
          }
        }

        updateFenceState(state, value, i);

        const char = value[i];
        output += char;
        state.atLineStart = char === "\n";
        i += 1;
      }

      return output;
    },
    finish() {
      const tail = state.inThink ? "" : state.pending;
      state.pending = "";
      state.inThink = false;
      return tail;
    },
  };
}

export function sanitizeThinkTags(content) {
  const filter = createThinkTagFilter();
  return filter.process(content) + filter.finish();
}
