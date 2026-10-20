import { error } from '@sveltejs/kit';
import { LEGAL, LEGAL_SLUGS, type LegalSlug } from '#lib/features/site/components/legal';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ params }) => {
	if (!LEGAL_SLUGS.includes(params.doc as LegalSlug)) error(404, 'Page not found.');
	return { slug: params.doc as LegalSlug, doc: LEGAL[params.doc as LegalSlug] };
};
