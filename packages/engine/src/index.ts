export * from './types.js';
export { EngineError } from './errors.js';
export { normalizeText, normalizeValue, findOccurrences, makeHaystack, INVISIBLE } from './normalize.js';
export type { Haystack } from './normalize.js';
export {
  createState,
  acceptMention,
  rejectMention,
  linkMention,
  addManualMention,
  entityValues,
  canonicalFor,
  findEntityByValue,
} from './state.js';
export { detect } from './detect.js';
export { mask, checkLeak } from './mask.js';
export { restore, createStreamRestorer } from './restore.js';
export {
  mergeLlmMentions,
  parseLlmOutput,
  buildLlmPrompt,
  chunkText,
  LLM_CATEGORIES,
  LLM_PROMPT_TEMPLATE,
} from './llm.js';
export { requiresReview, buildApiPayload } from './payload.js';
export { ingestText, protectFileName, summarize } from './session.js';
export type { ProtectionSummary } from './session.js';
