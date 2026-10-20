// Legal pages, written from what the product actually does. If a statement here stops being true,
// that is a bug in the product or in this file. Contact details come from the admin site settings.
export type LegalSection = { title: string; body: string[] };
export type LegalDoc = { title: string; summary: string; intro: string; sections: LegalSection[] };

export const LEGAL_UPDATED = '2026-10-20';
export const LEGAL_SLUGS = ['privacy', 'terms', 'refunds', 'cookies'] as const;
export type LegalSlug = (typeof LEGAL_SLUGS)[number];

const ENTITY = 'Upendra Competition Institute ("UCI", "we", "us")';

export const LEGAL: Record<LegalSlug, LegalDoc> = {
	privacy: {
		title: 'Privacy policy',
		summary: 'What personal data UCI collects in the website and app, why, who processes it, and your rights under Indian law.',
		intro: `This policy explains how ${ENTITY} handles personal data on this website and in the UCI app. It is written to comply with the Digital Personal Data Protection Act, 2023 and the Information Technology Act, 2000 and its rules.`,
		sections: [
			{
				title: 'What we collect',
				body: [
					'Account: when you sign in with Google we receive your name, email address and profile photo from Google. We never see your Google password.',
					'Profile: details you add during onboarding, such as your phone number, city and the exam you are preparing for.',
					'Study activity: lessons watched and your position in them, notes you bookmark, test attempts, the answers you mark, time taken, scores, ranks and percentiles.',
					'Enquiries: the name, mobile number, exam interest and message you send through the contact form.',
					'Payments: an order and payment reference, amount and status. Card, UPI and bank details are entered on Razorpay and are never stored by us.',
					'Technical: a session cookie that keeps you signed in, and server logs (IP address, time, page) kept for security and debugging.'
				]
			},
			{
				title: 'Why we use it',
				body: [
					'To run your account, show your courses, notes and tests, save your answers, calculate results and ranks, and let teachers see the progress of their students.',
					'To reply to your enquiry and to send notices about your batch or tests inside the app.',
					'To process payments, issue receipts and give you access to what you paid for.',
					'To keep the service secure, prevent abuse (for example rate limits on forms and test passwords) and fix problems.',
					'We do not sell personal data and we do not show third-party advertising.'
				]
			},
			{
				title: 'Who processes it for us',
				body: [
					'Google: sign-in (Google OAuth).',
					'Cloudflare R2: private storage for files such as PDFs and images uploaded by teachers. Files are served through short-lived signed links.',
					'Razorpay: payment processing. Razorpay handles your payment details under its own privacy policy and RBI rules.',
					'Google Gemini and OpenRouter: used only by teachers to draft practice questions from a topic or a PDF they upload. Student data is not sent to these AI services.',
					'YouTube: video lessons are embedded from YouTube (youtube-nocookie.com). YouTube may process data when you play a video.',
					'Our hosting provider stores the database and application servers.'
				]
			},
			{
				title: 'Who can see your data at UCI',
				body: [
					'Teachers and administrators of UCI can see student profiles, batches, test attempts and results to teach and manage batches. Only administrators can change roles and site settings.',
					'Other students see only what a rank list shows: your name and rank where a test publishes ranks.'
				]
			},
			{
				title: 'How long we keep it',
				body: [
					'Account and study data are kept while your account is active. Enquiries are kept for up to two years. Payment records are kept as long as Indian tax and accounting law requires.',
					'When you ask us to delete your account we delete or anonymise your personal data, except records we must keep by law.'
				]
			},
			{
				title: 'Your rights',
				body: [
					'You can ask to access, correct or erase your personal data, withdraw consent, and nominate another person to exercise your rights. Write to the grievance officer below; we reply within 30 days.',
					'If you are under 18, a parent or guardian should consent to your use of the app.'
				]
			},
			{
				title: 'Security',
				body: [
					'Data is sent over HTTPS. Sessions use secure, HTTP-only cookies. Uploaded files are private by default. Access inside UCI is limited by role.'
				]
			},
			{
				title: 'Changes',
				body: ['We will update the date at the top when this policy changes, and notify signed-in users in the app about material changes.']
			}
		]
	},
	terms: {
		title: 'Terms of use',
		summary: 'The rules for using the UCI website and app: accounts, tests, content, payments and liability.',
		intro: `These terms are an agreement between you and ${ENTITY} for the use of this website and the UCI app. By signing in you accept them.`,
		sections: [
			{
				title: 'Accounts',
				body: [
					'You sign in with a Google account. Keep that account secure; activity from it is treated as yours.',
					'One person, one account. Do not share your account or test passwords. We may suspend accounts that are shared, misused or used to disrupt the service.'
				]
			},
			{
				title: 'Tests and results',
				body: [
					'Some tests are open, some need a password given by your teacher, and some are part of a paid pass or batch.',
					'Live tests run on the server clock and allow one attempt. Answers are saved as you go; an attempt still open when time ends is submitted automatically.',
					'Ranks, percentiles and analysis are for practice. They are not an official result of any recruitment exam.',
					'Do not copy, share or publish test questions, or use unfair means during a test. We may cancel such attempts.'
				]
			},
			{
				title: 'Content',
				body: [
					'Courses, notes, questions, videos and the UCI name and logo belong to UCI or its teachers. You may use them for your own preparation only. Do not copy, resell, record or redistribute them.',
					'Exam names (SSC, RRB, MPPSC, MP Police and others) belong to the bodies that conduct them. UCI is a coaching institute and is not connected with any recruiting body.'
				]
			},
			{
				title: 'Payments',
				body: [
					'Prices are in Indian rupees and shown before you pay. Payments are processed by Razorpay. Access starts when the payment is confirmed and lasts for the validity shown on the product.',
					'Refunds follow the refund policy.'
				]
			},
			{
				title: 'Availability and liability',
				body: [
					'We work to keep the service available but do not promise it will be uninterrupted. If a technical fault on our side affects a live test, we will reschedule it or let you retake it.',
					'To the extent the law allows, UCI is not liable for indirect losses. Our total liability for a paid product is limited to the amount you paid for it.'
				]
			},
			{
				title: 'Law and disputes',
				body: ['These terms are governed by the laws of India. Courts in Madhya Pradesh have jurisdiction. Please contact the grievance officer first; most issues are solved quickly.']
			}
		]
	},
	refunds: {
		title: 'Refund policy',
		summary: 'When UCI refunds online payments for courses, test passes and tests, and how long a refund takes.',
		intro: 'This policy covers payments made online on this website or in the UCI app through Razorpay. Fees paid at the institute counter follow the receipt and rules given at admission.',
		sections: [
			{
				title: 'Failed or duplicate payments',
				body: ['If money was debited but the payment failed, or you were charged twice for the same product, we refund the extra amount in full. Razorpay usually reverses failed payments automatically within 5 to 7 working days.']
			},
			{
				title: 'Change of mind',
				body: [
					'You can ask for a refund within 7 days of payment if you have not substantially used the product: no more than 2 lessons beyond the free previews, and no test from the pass attempted.',
					'After 7 days, or after substantial use, purchases are not refundable, because digital content cannot be returned.'
				]
			},
			{
				title: 'Cancelled by UCI',
				body: ['If we cancel a paid course or pass before its validity ends, we refund the unused part in proportion to the remaining validity, or offer an equivalent product if you prefer.']
			},
			{
				title: 'How to ask',
				body: ['Write to the grievance officer below with your registered email, the order or payment ID from your receipt, and the reason. We reply within 3 working days.']
			},
			{
				title: 'How refunds are paid',
				body: ['Approved refunds go back to the original payment method through Razorpay. Banks and UPI apps usually show the credit within 5 to 7 working days of approval. Access to the refunded product ends when the refund is issued.']
			}
		]
	},
	cookies: {
		title: 'Cookie policy',
		summary: 'The few cookies and browser storage the UCI website and app use, and why. No advertising or tracking cookies.',
		intro: 'UCI uses only what the site needs to work. There are no advertising, analytics or cross-site tracking cookies.',
		sections: [
			{
				title: 'Cookies we set',
				body: [
					'uci_session: keeps you signed in. HTTP-only and secure, valid for up to 30 days and renewed while you use the app. Deleted when you sign out.',
					'uci_oauth: a short-lived cookie (10 minutes) that protects the Google sign-in step against forgery. Deleted once sign-in finishes.'
				]
			},
			{
				title: 'Browser storage',
				body: [
					'theme: remembers whether you chose the light or dark theme.',
					'Test answers: during a test, your answers are also kept in your browser so nothing is lost if the network drops. They are used only for that attempt.',
					'App cache: the installed app (PWA) stores pages and files so it opens fast and works offline.'
				]
			},
			{
				title: 'Third parties',
				body: [
					'Google sets its own cookies on its sign-in page. YouTube may set cookies when you play an embedded video lesson; we use the privacy-enhanced youtube-nocookie.com player. Razorpay sets cookies in its payment window to process and secure the payment.'
				]
			},
			{
				title: 'Your choices',
				body: ['You can clear cookies and site data in your browser settings at any time. Blocking the session cookie means you cannot stay signed in.']
			}
		]
	}
};
