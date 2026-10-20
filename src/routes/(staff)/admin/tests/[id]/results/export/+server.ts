import { getTest, resultsCsv } from '#lib/features/tests/server/service';
import { requireStaff, toHttp } from '#lib/server/http';
import type { RequestHandler } from './$types';

/** Results sheet as CSV (opens in Excel / Sheets). */
export const GET: RequestHandler = async (event) => {
	requireStaff(event);
	try {
		const [t, csv] = await Promise.all([getTest(event.params.id), resultsCsv(event.params.id)]);
		const file = `${t.title.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') || 'results'}-results.csv`;
		return new Response('﻿' + csv, {
			headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="${file}"` }
		});
	} catch (e) {
		toHttp(e);
	}
};
