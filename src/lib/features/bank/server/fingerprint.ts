// Duplicate guard for bank questions (same idea as the AI feature's dedupe, kept local to avoid coupling).
import { createHash } from 'node:crypto';

/** Prompt normalised (lower-case, punctuation/symbols/whitespace collapsed) then sha256: the duplicate guard. */
export const normalisePrompt = (prompt: string) =>
	prompt
		.toLowerCase()
		.replace(/[\p{P}\p{S}\s]+/gu, ' ')
		.trim();
export const fingerprint = (prompt: string) => createHash('sha256').update(normalisePrompt(prompt)).digest('hex');
