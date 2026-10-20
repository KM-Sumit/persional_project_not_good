// Client-safe formatting for the public site. All times are shown in IST.
const IST = 'Asia/Kolkata';

/** "Tue 21 Oct" */
export const dayIST = (iso: string) => new Intl.DateTimeFormat('en-IN', { timeZone: IST, weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(iso));
/** "10:00 am IST" */
export const timeIST = (iso: string) =>
	new Intl.DateTimeFormat('en-IN', { timeZone: IST, hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(iso)).toUpperCase() + ' IST';
/** "₹1,499" */
export const inr = (n: number) => '₹' + n.toLocaleString('en-IN');
/** "3 h 20 min" / "45 min" */
export const hours = (sec: number) => {
	const m = Math.round(sec / 60);
	return m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}` : `${m} min`;
};
export const plural = (n: number, one: string, many = one + 's') => `${n} ${n === 1 ? one : many}`;
/** Seeded placeholder copy ("Add the institute address in Admin > Site") is not real content. */
export const real = (v: string | undefined | null) => (v && !/^Add (the|your) /i.test(v) ? v : '');
export const waLink = (num: string | undefined, text = '') =>
	num ? `https://wa.me/${num.replace(/\D/g, '')}${text ? `?text=${encodeURIComponent(text)}` : ''}` : null;

/** schema.org organisation block from the admin-editable settings (only real values). */
export function orgJsonLd(s: import('../schema').SiteSettings, origin: string) {
	const sameAs = Object.values(s.socials ?? {}).filter(Boolean);
	return {
		'@context': 'https://schema.org',
		'@type': 'EducationalOrganization',
		name: 'Upendra Competition Institute',
		alternateName: ['UCI', 'UCI'],
		slogan: 'Dream. Prepare. Achieve.',
		url: origin,
		logo: origin + '/brand/uci.png',
		...(s.contactPhone ? { telephone: s.contactPhone } : {}),
		...(s.email ? { email: s.email } : {}),
		...(real(s.address) ? { address: { '@type': 'PostalAddress', streetAddress: real(s.address), addressRegion: 'Madhya Pradesh', addressCountry: 'IN' } } : {}),
		...(sameAs.length ? { sameAs } : {})
	};
}
