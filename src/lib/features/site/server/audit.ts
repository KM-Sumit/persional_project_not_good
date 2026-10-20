import { db } from '#lib/server/db';
import { auditLog } from '#lib/server/db/schema';

/** Records who changed what ("test.publish", target id). Never throws: auditing must not break the action. */
export async function audit(actorId: string | null, action: string, target = '', meta?: Record<string, unknown>) {
	try {
		await db().insert(auditLog).values({ actorId, action, target, meta: meta ?? null });
	} catch (e) {
		console.error('audit failed', action, e);
	}
}
