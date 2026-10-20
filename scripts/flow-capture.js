async (page) => {
	await page.goto('http://127.0.0.1:5174/');
	await page.evaluate(async () => {
		const regs = await navigator.serviceWorker?.getRegistrations?.() ?? [];
		await Promise.all(regs.map((r) => r.unregister()));
		const keys = await caches.keys();
		await Promise.all(keys.map((k) => caches.delete(k)));
	});
	const base = 'http://127.0.0.1:5174';
	const dir = '/Users/divyansh/Desktop/code/sumit/uci/flow/shots';
	const sizes = [
		['phone', 390, 844],
		['tablet', 768, 1024],
		['desktop', 1440, 900]
	];

	const ids = {
		course: '161ef574-d5b0-44ed-8cd0-b27ac25ac79a',
		lesson: 'fc1d4c85-2ea5-4d5b-952a-f2293b3de2a2',
		note: '8daf0310-6099-4e2f-a674-f406ef0b3542',
		testCode: '8d110a32-e336-4ef0-b39d-4c3f3a38e328',
		testPassword: 'a89e9ab3-a627-4790-94f6-27b2a79e0af5',
		testModule: '45b6f7ae-660f-4e48-bd48-3135df08a617',
		result: 'bf7f6666-b51e-4a80-8a9a-4a7fd514cfe4'
	};

	const report = [];
	const errors = [];
	page.on('pageerror', (e) => errors.push(String(e)));

	async function measure() {
		return page.evaluate(() => {
			const doc = document.documentElement;
			const err = document.querySelector('[data-sveltekit-hydrate-error], .error');
			return {
				path: location.pathname,
				overflowX: doc.scrollWidth > doc.clientWidth + 1,
				gap: window.innerWidth - doc.clientWidth,
				error: !!err || /not found|500|error/i.test(document.title)
			};
		});
	}

	async function shot(id, url, opts = {}) {
		for (const [name, w, h] of sizes) {
			if (opts.desktopOnly && name !== 'desktop') continue;
			await page.setViewportSize({ width: w, height: h });
			await page.goto(url, { waitUntil: 'networkidle' });
			await page.waitForSelector('h1, .page-title, .public-shell, .sheet', { timeout: 15000 }).catch(() => {});
			if (opts.waitMs) await page.waitForTimeout(opts.waitMs);
			const m = await measure();
			report.push({ id, size: name, ...m, ok: !m.overflowX && !m.error });
			await page.screenshot({ path: `${dir}/${id}-${name}.png`, fullPage: true });
		}
	}

	await page.context().clearCookies();
	for (const id of ['landing', 'signin', 'terms', 'privacy', 'cookies']) {
		const path = id === 'landing' ? '/' : `/${id}`;
		await shot(id, `${base}${path}`);
	}

	await page.goto(`${base}/api/auth/google/mock`);
	await page.waitForLoadState('networkidle');

	await shot('home', `${base}/home`);
	await shot('tests', `${base}/tests`);
	await shot('test-code', `${base}/tests/${ids.testCode}`);
	await shot('test-password', `${base}/tests/${ids.testPassword}`);
	await shot('test-module', `${base}/tests/${ids.testModule}`);
	await shot('study', `${base}/study`);
	await shot('course', `${base}/courses/${ids.course}`);
	await shot('lesson', `${base}/courses/${ids.course}/lessons/${ids.lesson}`);
	await shot('note', `${base}/notes/${ids.note}`);
	await shot('profile', `${base}/profile`);
	await shot('result', `${base}/attempts/${ids.result}/result`);

	await page.goto(`${base}/tests/${ids.testModule}`);
	const start = page.locator('form[action="?/start"] button[type="submit"]');
	if (await start.isVisible().catch(() => false)) {
		await start.click();
		await page.waitForURL(/\/attempts\//, { timeout: 15000 });
		if (!page.url().includes('/result')) {
			await page.waitForSelector('.sheet', { timeout: 10000 });
			for (const [name, w, h] of sizes) {
				await page.setViewportSize({ width: w, height: h });
				const m = await measure();
				report.push({ id: 'attempt', size: name, ...m, ok: !m.overflowX && !m.error });
				await page.screenshot({ path: `${dir}/attempt-${name}.png`, fullPage: true });
			}
		}
	}

	await page.goto(`${base}/api/auth/google/mock?as=admin`);
	await page.waitForLoadState('networkidle');
	await shot('admin', `${base}/admin`, { desktopOnly: true });

	const bad = report.filter((r) => !r.ok);
	return { errors, bad, report };
}
