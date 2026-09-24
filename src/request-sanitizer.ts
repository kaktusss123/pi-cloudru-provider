/**
 * Request sanitization for the Cloud.ru gateway.
 *
 * Two proven gateway/backend quirks:
 * - The gateway turns a JSON empty array `"tools": []` into `{}` (Python
 *   `or {}` pattern), which the vLLM backend rejects with 400
 *   `list_type` on `body.tools`. Dropping the field entirely is accepted.
 * - At most 5 images may be provided in one prompt; more yields 400
 *   "At most 5 image(s) may be provided in one prompt.".
 */

const OMITTED_IMAGE_TEXT = "[image omitted: provider image limit]";

export const MAX_IMAGES_PER_REQUEST = 5;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isImagePart(part: unknown): boolean {
  return isRecord(part) && part.type === "image_url";
}

/**
 * Remove a `tools` key when it holds an empty array. Anything else passes
 * through unchanged (same reference when nothing changed).
 */
export function stripEmptyTools(payload: unknown): unknown {
  if (!isRecord(payload)) return payload;
  if (Array.isArray(payload.tools) && payload.tools.length === 0) {
    const next = { ...payload };
    delete next.tools;
    return next;
  }
  return payload;
}

/**
 * Keep only the newest `maxImages` image parts across all messages (scanning
 * from the end). Older image parts are replaced with a text placeholder
 * instead of being deleted, so no message ends up with an empty content
 * array. Clones only the objects on the changed path; unchanged messages,
 * content arrays, and parts keep their original references.
 */
export function trimExcessImages(payload: unknown, maxImages: number = MAX_IMAGES_PER_REQUEST): unknown {
  if (!isRecord(payload) || !Array.isArray(payload.messages)) return payload;
  if (maxImages < 0) maxImages = 0;

  const imageKeys = new Set<string>();
  let total = 0;
  for (let m = 0; m < payload.messages.length; m++) {
    const message = payload.messages[m];
    if (!isRecord(message) || !Array.isArray(message.content)) continue;
    for (let p = 0; p < message.content.length; p++) {
      if (isImagePart(message.content[p])) {
        imageKeys.add(`${m}:${p}`);
        total++;
      }
    }
  }
  if (total <= maxImages) return payload;

  const keep = new Set([...imageKeys].slice(-maxImages));
  let changed = false;
  const messages = payload.messages.map((message, m) => {
    if (!isRecord(message) || !Array.isArray(message.content)) return message;
    let messageChanged = false;
    const content = message.content.map((part, p) => {
      if (isImagePart(part) && !keep.has(`${m}:${p}`)) {
        messageChanged = true;
        return { type: "text", text: OMITTED_IMAGE_TEXT };
      }
      return part;
    });
    if (!messageChanged) return message;
    changed = true;
    return { ...message, content };
  });
  return changed ? { ...payload, messages } : payload;
}

/** Apply every request sanitizer in order. */
export function sanitizeProviderPayload(payload: unknown, maxImages: number = MAX_IMAGES_PER_REQUEST): unknown {
  return trimExcessImages(stripEmptyTools(payload), maxImages);
}
