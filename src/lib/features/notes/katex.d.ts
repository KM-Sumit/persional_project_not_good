// katex ships no types; we only call renderToString.
declare module 'katex' {
	const katex: {
		renderToString(tex: string, opts?: { displayMode?: boolean; throwOnError?: boolean; trust?: boolean; strict?: boolean | string; output?: string }): string;
	};
	export default katex;
}
