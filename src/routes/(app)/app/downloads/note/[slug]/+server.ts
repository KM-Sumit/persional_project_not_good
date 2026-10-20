import { error } from '@sveltejs/kit';
import { noteAccess } from '#lib/features/billing/server/paywall';
import { noteForUser } from '#lib/features/notes/server/service';
import { requireUser, toHttp } from '#lib/server/http';
import type { RequestHandler } from './$types';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/**
 * A self-contained copy of a note (inline styles, no app bundles), so a saved note still opens offline
 * after the app updates and its old JS/CSS bundles are gone. Note HTML is already sanitised by renderDoc.
 */
export const GET: RequestHandler = async (event) => {
	const u = requireUser(event);
	const n = await noteForUser(u, event.params.slug).catch(toHttp);
	if (!(await noteAccess(u.id, n.id))) error(403, 'Unlock this note to save it.');
	const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(n.title)} · UCI</title>
<style>
:root{--bg:210 16% 96.5%;--fg:222 22% 10%;--muted:205 14% 38%;--border:200 16% 87%;--primary:24 88% 41%;--code:200 18% 92%;color-scheme:light dark}
@media (prefers-color-scheme:dark){:root{--bg:222 18% 7%;--fg:200 22% 93%;--muted:205 14% 67%;--border:222 12% 19%;--primary:27 88% 62%;--code:222 14% 15%}}
*{box-sizing:border-box}body{margin:0;background:hsl(var(--bg));color:hsl(var(--fg));font:16px/1.7 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:70ch;margin:0 auto;padding:16px 16px 48px}a{color:hsl(var(--primary))}
.top{display:flex;justify-content:space-between;gap:12px;font-size:14px;padding:8px 0 16px;border-bottom:1px solid hsl(var(--border));margin-bottom:20px}
.top span{color:hsl(var(--muted))}h1{font-size:1.75rem;line-height:1.2;margin:0 0 8px}.lede{color:hsl(var(--muted));font-size:1.0625rem}
h2,h3,h4{line-height:1.3;margin:1.6em 0 .5em}img,svg,video{max-width:100%;height:auto}
pre{overflow-x:auto;background:hsl(var(--code));padding:12px;border-radius:8px}code{background:hsl(var(--code));padding:0 4px;border-radius:4px}
table{border-collapse:collapse;display:block;overflow-x:auto;max-width:100%}th,td{border:1px solid hsl(var(--border));padding:6px 10px}
blockquote{margin:0;padding-left:14px;border-left:3px solid hsl(var(--border));color:hsl(var(--muted))}.katex-display{overflow-x:auto}
</style></head>
<body><main>
<div class="top"><a href="/app/downloads">Downloads</a><span>Saved copy · works offline</span></div>
<h1>${esc(n.title)}</h1>
${n.summary ? `<p class="lede">${esc(n.summary)}</p>` : ''}
${n.html}
</main></body></html>`;
	return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'private, no-store' } });
};
