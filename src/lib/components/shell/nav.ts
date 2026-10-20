// Navigation maps for the two signed-in areas. One source for the desktop sidebar, the tablet/phone tab bar
// and the staff "More" sheet, so every surface agrees on names, icons and order.
import {
	BadgeIndianRupee,
	BookOpen,
	BookOpenText,
	ClipboardList,
	Download,
	MessageCircleQuestion,
	Newspaper,
	Radio,
	TicketPercent,
	Globe,
	House,
	Image,
	Inbox,
	Layers,
	LayoutDashboard,
	Library,
	ListChecks,
	ReceiptIndianRupee,
	Megaphone,
	MessagesSquare,
	NotebookText,
	ShieldCheck,
	Tags,
	UserRound,
	UsersRound
} from '@lucide/svelte';

export type NavItem = { href: string; label: string; icon: typeof House; adminOnly?: boolean };
export type NavGroup = { label: string; items: NavItem[] };

const starts = (prefix: string, p: string) => p === prefix || p.startsWith(prefix + '/');

/** Most specific match wins, so a section root (/app, /admin) is only active when nothing deeper claims the path. */
export function activeHref(items: NavItem[], path: string) {
	return [...items].sort((a, b) => b.href.length - a.href.length).find((i) => starts(i.href, path))?.href;
}

export const studentTabs: NavItem[] = [
	{ href: '/app', label: 'Today', icon: House },
	{ href: '/app/learn', label: 'Learn', icon: BookOpen },
	{ href: '/app/tests', label: 'Tests', icon: ListChecks },
	{ href: '/app/notes', label: 'Notes', icon: NotebookText },
	{ href: '/app/me', label: 'Me', icon: UserRound }
];

export const studentGroups: NavGroup[] = [
	{ label: 'Study', items: studentTabs.slice(0, 4) },
	{
		label: 'Every day',
		items: [
			{ href: '/app/live', label: 'Live classes', icon: Radio },
			{ href: '/app/daily', label: 'Current affairs', icon: Newspaper },
			{ href: '/app/doubts', label: 'Doubts', icon: MessageCircleQuestion },
			{ href: '/app/downloads', label: 'Downloads', icon: Download }
		]
	},
	{
		label: 'You',
		items: [
			{ href: '/app/inbox', label: 'Inbox', icon: Inbox },
			{ href: '/app/me', label: 'Profile', icon: UserRound }
		]
	}
];

export const staffGroups: NavGroup[] = [
	{ label: 'Overview', items: [{ href: '/admin', label: 'Dashboard', icon: LayoutDashboard }] },
	{
		label: 'Teach',
		items: [
			{ href: '/admin/tests', label: 'Tests', icon: ClipboardList },
			{ href: '/admin/bank', label: 'Question bank', icon: Library },
			{ href: '/admin/courses', label: 'Courses', icon: BookOpenText },
			{ href: '/admin/notes', label: 'Notes', icon: NotebookText },
			{ href: '/admin/live', label: 'Live classes', icon: Radio },
			{ href: '/admin/posts', label: 'Daily posts', icon: Newspaper },
			{ href: '/admin/doubts', label: 'Doubts', icon: MessageCircleQuestion }
		]
	},
	{
		label: 'People',
		items: [
			{ href: '/admin/students', label: 'Students', icon: UsersRound },
			{ href: '/admin/batches', label: 'Sessions & batches', icon: Layers }
		]
	},
	{
		label: 'Reach',
		items: [
			{ href: '/admin/announcements', label: 'Announcements', icon: Megaphone },
			{ href: '/admin/banners', label: 'Home banners', icon: Image },
			{ href: '/admin/leads', label: 'Enquiries', icon: MessagesSquare },
			{ href: '/admin/site', label: 'Website', icon: Globe }
		]
	},
	{
		label: 'Sales',
		items: [
			{ href: '/admin/products', label: 'Passes & prices', icon: BadgeIndianRupee },
			{ href: '/admin/payments', label: 'Payments', icon: ReceiptIndianRupee },
			{ href: '/admin/coupons', label: 'Coupons', icon: TicketPercent }
		]
	},
	{
		label: 'Setup',
		items: [
			{ href: '/admin/taxonomy', label: 'Exams & subjects', icon: Tags },
			{ href: '/admin/team', label: 'Team & roles', icon: ShieldCheck, adminOnly: true }
		]
	}
];

/** Phone/tablet tabs for staff; everything else sits in the More sheet. */
export const staffTabs: NavItem[] = [
	{ href: '/admin', label: 'Home', icon: LayoutDashboard },
	{ href: '/admin/tests', label: 'Tests', icon: ClipboardList },
	{ href: '/admin/bank', label: 'Bank', icon: Library },
	{ href: '/admin/students', label: 'Students', icon: UsersRound }
];

