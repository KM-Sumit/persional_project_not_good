import { afterAll, expect, test } from 'bun:test';
import { inArray } from 'drizzle-orm';
import { db } from '../../../server/db/index';
import { examCategories, subjects } from '../../../server/db/schema';
import * as svc from './service';

const tag = crypto.randomUUID().slice(0, 8);
const catIds: string[] = [];
const subjectIds: string[] = [];
afterAll(async () => {
	if (catIds.length) await db().delete(examCategories).where(inArray(examCategories.id, catIds));
	if (subjectIds.length) await db().delete(subjects).where(inArray(subjects.id, subjectIds));
});

test('categories, exams, subjects: CRUD, slugs, reorder, enable, cached tree', async () => {
	const c = await svc.createCategory({ name: `Cat ${tag}` });
	catIds.push(c.id);
	const e1 = await svc.createExam({ categoryId: c.id, name: `Exam ${tag}` });
	const e2 = await svc.createExam({ categoryId: c.id, name: `Exam ${tag}` });
	await svc.reorderExams(c.id, [e2.id, e1.id]);
	await svc.setExamEnabled(e1.id, false);
	await expect(svc.createCategory({ name: 'x', slug: `cat-${tag}` })).rejects.toThrow('already exists');

	const s = await svc.createSubject({ name: `Subject ${tag}` });
	subjectIds.push(s.id);
	await expect(svc.createSubject({ name: `Subject ${tag}` })).rejects.toThrow('already exists');

	const t = await svc.tree();
	const cat = t.categories.find((x) => x.id === c.id)!;
	expect(cat.slug).toBe(`cat-${tag}`);
	expect(cat.exams.map((e) => e.slug)).toEqual([`exam-${tag}-2`, `exam-${tag}`]);
	expect(svc.enabledOnly(t).categories.find((x) => x.id === c.id)!.exams.map((e) => e.id)).toEqual([e2.id]);
	expect(t.subjects.some((x) => x.id === s.id)).toBe(true);
	expect((await svc.examMap()).get(e2.id)?.categoryName).toBe(`Cat ${tag}`);

	await svc.setCategoryEnabled(c.id, false);
	expect(svc.enabledOnly(await svc.tree()).categories.some((x) => x.id === c.id)).toBe(false);
	await svc.deleteExam(e1.id);
	expect((await svc.tree()).categories.find((x) => x.id === c.id)!.exams).toHaveLength(1);
});
