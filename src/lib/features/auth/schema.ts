import { z } from 'zod';

export type SessionUser = {
	id: string;
	name: string;
	email: string;
	role: 'student' | 'admin';
};

export const noticeSchema = z.object({
	title: z.string().trim().min(1, 'Add a title').max(120),
	body: z.string().trim().min(1, 'Add a message').max(2000)
});

export const passwordSchema = z.object({
	password: z.string().min(1, 'Enter the password').max(200)
});

export const answerSchema = z.object({
	questionId: z.uuid(),
	selectedIndex: z.number().int().min(0).max(10)
});
