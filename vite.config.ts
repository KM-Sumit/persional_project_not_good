import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	// e2e scripts and screenshots are not app code: don't reload dev servers when they change.
	server: { watch: { ignored: ['**/e2e/**'] } },
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter(),
			// Absolute asset paths so the service worker's cached offline page works on nested routes.
			paths: { relative: false },
			// SECURITY.md #9: report-only for now (violations show in the browser console). Flip `reportOnly`
			// to `directives` after a week with no violations. Nonces/hashes for SvelteKit's inline scripts are automatic.
			csp: {
				mode: 'auto',
				reportOnly: {
					'default-src': ['self'],
					'script-src': ['self', 'https://www.youtube.com', 'https://s.ytimg.com', 'https://checkout.razorpay.com'],
					'frame-src': ['https://www.youtube-nocookie.com', 'https://www.youtube.com', 'https://api.razorpay.com', 'https://checkout.razorpay.com'],
					'connect-src': ['self', 'https://lumberjack.razorpay.com'],
					'img-src': ['self', 'data:', 'blob:', 'https://lh3.googleusercontent.com', 'https://i.ytimg.com', 'https://*.r2.cloudflarestorage.com'],
					'style-src': ['self', 'unsafe-inline', 'https://fonts.googleapis.com'],
					// data: — KaTeX (Vite may inline one small woff2); keeps report-only noise down before enforce.
					'font-src': ['self', 'data:', 'https://fonts.gstatic.com'],
					'frame-ancestors': ['none'],
					'base-uri': ['self'],
					'form-action': ['self', 'https://accounts.google.com'],
					// SvelteKit refuses to render without a report target in report-only mode.
					'report-uri': ['/api/csp-report']
				}
			}
		})
	]
});
