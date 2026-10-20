<script lang="ts">
	import LegalDoc from '$lib/components/marketing/LegalDoc.svelte';
</script>

<LegalDoc title="Privacy policy" updated="20 October 2026">
	<h2>Overview</h2>
	<p>
		This Privacy policy explains how Upendra Competition Institute (“we”, “us”) collects, uses, and shares personal
		information when you use our exam preparation service. The service is India-first but may be
		accessed from other countries. The operator of Upendra Competition Institute is responsible for this policy.
	</p>

	<h2>What we collect</h2>
	<p>We collect information you provide and information generated when you use the service:</p>
	<ul>
		<li>
			<strong>Account and identity:</strong> name, email address, and Google account subject identifier
			when you sign in with Google OAuth (or mock sign-in in development)
		</li>
		<li>
			<strong>Learning activity:</strong> test attempt answers, scores, timestamps, and lesson or course
			progress
		</li>
		<li>
			<strong>Session and security:</strong> session cookies and similar tokens to keep you signed in and
			protect the service
		</li>
		<li>
			<strong>Preferences:</strong> theme or display preferences stored locally or in cookies (see our
			<a href="/cookies">Cookie policy</a>)
		</li>
		<li>
			<strong>Technical data:</strong> basic server logs (such as IP address, user agent, and request
			timestamps) needed for security and troubleshooting
		</li>
	</ul>
	<p>
		We do not run product analytics tools at this time. We do not send marketing emails at this time;
		transactional emails (such as receipts or account notices) may be added later.
	</p>
	<p>We do not knowingly collect payment card numbers on our servers today; paid features may use a payment processor in the future.</p>

	<h2>Why we use it</h2>
	<p>We use personal information to:</p>
	<ul>
		<li>Provide timed tests, courses, notes, and progress tracking</li>
		<li>Authenticate you and maintain your session</li>
		<li>Operate, secure, and debug the service</li>
		<li>Comply with law and enforce our <a href="/terms">Terms of service</a></li>
		<li>Improve content and features (using aggregated or de-identified data where possible)</li>
	</ul>

	<h2>Who we share it with</h2>
	<p>We share information only as needed to run the service:</p>
	<ul>
		<li>
			<strong>Google:</strong> when you choose Google sign-in, Google processes authentication according
			to its own policies
		</li>
		<li>
			<strong>Infrastructure providers:</strong> self-hosted Node (Dokploy), PostgreSQL database, Valkey
			or Redis cache, and Cloudflare R2 for stored files when used — under our control and contracts
		</li>
		<li>
			<strong>Legal and safety:</strong> when required by law, court order, or to protect rights, safety,
			and integrity of the service
		</li>
	</ul>
	<p><strong>We do not sell your personal information.</strong></p>

	<h2>Retention</h2>
	<p>
		We keep account and learning data while your account is active. After you request deletion or
		close your account, we delete or anonymize personal data within a reasonable period (typically
		within 90 days), except where we must retain records for legal, tax, or security reasons.
	</p>
	<p>Server logs are kept for a limited time for security and then rotated or deleted.</p>

	<h2>Your rights</h2>
	<p>Depending on where you live, you may have the right to:</p>
	<ul>
		<li>Access a copy of your personal information</li>
		<li>Correct inaccurate information</li>
		<li>Delete your account and associated data</li>
		<li>Export your data in a portable format</li>
		<li>Object to or restrict certain processing</li>
		<li>Withdraw consent where processing is based on consent</li>
	</ul>
	<p>
		To exercise these rights, email
		<a href="mailto:privacy@uci.exam">privacy@uci.exam</a>. We may need to verify your identity. We
		will respond within a reasonable time and as required by applicable law.
	</p>

	<h2>Security</h2>
	<p>
		We use reasonable technical and organizational measures to protect personal information,
		including encryption in transit (HTTPS), access controls, and secured infrastructure. No method of
		transmission or storage is completely secure; use a strong Google account and report suspected
		issues to us promptly.
	</p>

	<h2>Children</h2>
	<p>
		The service is intended for users aged 13 and older. We do not knowingly collect personal
		information from children under 13. If you believe a child under 13 has provided data, contact
		<a href="mailto:privacy@uci.exam">privacy@uci.exam</a> and we will take appropriate steps to delete
		it. Users under the age of majority may need parental consent where local law requires it.
	</p>

	<h2>International transfers</h2>
	<p>
		We primarily process data in India on infrastructure we operate. If you access the service from
		outside India, your information may be transferred to and processed in India or where our
		subprocessors operate. We take steps designed to protect data in line with this policy and
		applicable law.
	</p>

	<h2>GDPR (European Economic Area, UK, and similar laws)</h2>
	<p>If you are in the EEA, UK, or a region with similar data protection law, the following also applies:</p>
	<ul>
		<li>
			<strong>Legal bases:</strong> performance of a contract (providing the service), legitimate interests
			(security, improvement, fraud prevention), consent where required (for example optional cookies), and
			legal obligation
		</li>
		<li>
			<strong>Controller:</strong> the operator of Upendra Competition Institute. Contact:
			<a href="mailto:privacy@uci.exam">privacy@uci.exam</a>
		</li>
		<li>
			<strong>Rights:</strong> access, rectification, erasure, restriction, portability, objection, and
			lodging a complaint with your local supervisory authority
		</li>
	</ul>

	<h2>CCPA / CPRA (California residents)</h2>
	<p>If you are a California resident, you have additional rights under the CCPA/CPRA, including:</p>
	<ul>
		<li>Right to know categories and specific pieces of personal information we collect and use</li>
		<li>Right to delete personal information, subject to exceptions</li>
		<li>Right to correct inaccurate personal information</li>
		<li>
			Right to opt out of “sale” or “sharing” of personal information — we do not sell or share personal
			information for cross-context behavioral advertising
		</li>
		<li>Right to non-discrimination for exercising privacy rights</li>
	</ul>
	<p>
		Categories collected in the last 12 months may include identifiers, internet activity (server logs),
		and education-related information (attempt answers and progress). Submit requests to
		<a href="mailto:privacy@uci.exam">privacy@uci.exam</a>.
	</p>

	<h2>Changes</h2>
	<p>
		We may update this policy. We will post changes on this page and update the “Last updated” date.
		Material changes will be communicated when we have a way to reach you.
	</p>

	<h2>Contact</h2>
	<p>
		Privacy questions and requests:
		<a href="mailto:privacy@uci.exam">privacy@uci.exam</a>.
	</p>
	<p>
		General support:
		<a href="mailto:support@uci.exam">support@uci.exam</a>.
	</p>
</LegalDoc>
