import { requireStaff } from '#lib/server/http';
import { exportPeopleCsv } from '#lib/features/people/server/service';
import { peopleQuery } from '../_query.server';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	requireStaff(event);
	const csv = await exportPeopleCsv(peopleQuery(event.url));
	return new Response('﻿' + csv, {
		headers: {
			'content-type': 'text/csv; charset=utf-8',
			'content-disposition': `attachment; filename="students-${new Date().toISOString().slice(0, 10)}.csv"`
		}
	});
};
