export type PaperLang = 'en' | 'hi';

const KEY = 'uci-paper-lang';

export function readPaperLang(): PaperLang {
	try {
		return localStorage.getItem(KEY) === 'hi' ? 'hi' : 'en';
	} catch {
		return 'en';
	}
}

export function writePaperLang(lang: PaperLang) {
	try {
		localStorage.setItem(KEY, lang);
	} catch {
		/* private mode */
	}
}

export function paperLine(en: string, hi: string | null | undefined, lang: PaperLang) {
	return lang === 'hi' && hi?.trim() ? hi : en;
}

export function paperLines(en: string[], hi: (string | null)[] | null | undefined, lang: PaperLang) {
	return en.map((text, i) => paperLine(text, hi?.[i], lang));
}
