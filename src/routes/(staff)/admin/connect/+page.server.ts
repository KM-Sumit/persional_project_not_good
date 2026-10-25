import { requireStaff } from '#lib/server/http';
import { normalizeIndianPhone } from '#lib/features/site/schema';
import * as site from '#lib/features/site/server/service';
import { act, str } from '../students/_act.server';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	requireStaff(event);
	const settings = await site.getSettings();
	return {
		links: {
			youtube: settings.socials?.youtube ?? '',
			instagram: settings.socials?.instagram ?? '',
			facebook: settings.socials?.facebook ?? '',
			whatsapp: settings.socials?.whatsapp ?? ''
		}
	};
};

/** A full https link, or an Indian mobile turned into a WhatsApp chat link. */
function whatsappLink(raw: string): string | undefined {
	if (!raw) return undefined;
	if (/^https:\/\//i.test(raw)) return raw;
	const phone = normalizeIndianPhone(raw);
	if (!phone) return raw;
	return `https://wa.me/${phone.replace(/\D/g, '')}`;
}

export const actions: Actions = {
	default: async (event) => {
		const me = requireStaff(event);
		const d = await event.request.formData();
		const current = await site.getSettings();
		const socials = {
			...current.socials,
			youtube: str(d, 'youtube') || undefined,
			instagram: str(d, 'instagram') || undefined,
			facebook: str(d, 'facebook') || undefined,
			whatsapp: whatsappLink(str(d, 'whatsapp'))
		};
		return act(() => site.setSettings({ socials }, me.id), 'Links saved');
	}
};
