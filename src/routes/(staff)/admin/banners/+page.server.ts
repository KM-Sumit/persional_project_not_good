import { requireStaff } from '#lib/server/http';
import { createBanner, deleteBanner, listBanners, reorderBanners, setBannerEnabled, updateBanner } from '#lib/features/engage/server/service';
import { act, ids, on, str } from '../students/_act.server';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	requireStaff(event);
	return { banners: await listBanners() };
};

export const actions: Actions = {
	save: async (event) => {
		requireStaff(event);
		const d = await event.request.formData();
		const id = str(d, 'id');
		const fileId = str(d, 'imageFileId') || null;
		const input = {
			title: str(d, 'title'),
			subtitle: str(d, 'subtitle'),
			ctaLabel: str(d, 'ctaLabel') || 'Explore',
			href: str(d, 'href') || '/app',
			imageFileId: fileId,
			imageUrl: fileId ? null : str(d, 'imageUrl') || null,
			enabled: on(d, 'enabled')
		};
		return act(() => (id ? updateBanner(id, input) : createBanner(input)), id ? 'Banner saved' : 'Banner added');
	},
	toggle: async (event) => {
		requireStaff(event);
		const d = await event.request.formData();
		const en = on(d, 'enabled');
		return act(() => setBannerEnabled(str(d, 'id'), en), en ? 'Banner shown' : 'Banner hidden');
	},
	reorder: async (event) => {
		requireStaff(event);
		const d = await event.request.formData();
		return act(() => reorderBanners(ids(d)), 'Order saved');
	},
	delete: async (event) => {
		requireStaff(event);
		const d = await event.request.formData();
		return act(() => deleteBanner(str(d, 'id')), 'Banner deleted');
	}
};
