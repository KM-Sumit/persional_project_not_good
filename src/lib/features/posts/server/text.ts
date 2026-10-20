/** Markdown -> plain text for the AI context (keeps the prompt small): no links, marks, math delimiters or extra space. */
export const plainText = (md: string, max: number) =>
	md
		.replace(/!\[[^\]]*\]\([^)]*\)/g, '')
		.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
		.replace(/[#*_>`$|~]+/g, ' ')
		.replace(/^\s*[-+]\s+/gm, ' ')
		.replace(/\s+/g, ' ')
		.trim()
		.slice(0, max);
