// Exam taxonomy (categories -> exams) + subjects: Zod inputs and DTOs (client-safe).
import { z } from 'zod';
import { boolish } from '../courses/schema';

const name = z.string().trim().min(1, 'Name is required.').max(120);
const slug = z
	.string()
	.trim()
	.toLowerCase()
	.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and dashes.')
	.max(80);

export const categoryInput = z.object({
	name,
	slug: slug.optional(),
	description: z.string().trim().max(500).default(''),
	enabled: boolish.default(true)
});
export const categoryUpdate = z.object({
	name: name.optional(),
	slug: slug.optional(),
	description: z.string().trim().max(500).optional(),
	enabled: boolish.optional()
});
export const examInput = categoryInput.extend({ categoryId: z.uuid() });
export const examUpdate = categoryUpdate.extend({ categoryId: z.uuid().optional() });
export const subjectInput = z.object({ name });

export type SubjectDTO = { id: string; name: string; sortOrder: number };
export type ExamDTO = {
	id: string;
	categoryId: string;
	name: string;
	slug: string;
	description: string;
	sortOrder: number;
	enabled: boolean;
};
export type CategoryDTO = Omit<ExamDTO, 'categoryId'> & { exams: ExamDTO[] };
export type TaxonomyTree = { categories: CategoryDTO[]; subjects: SubjectDTO[] };
