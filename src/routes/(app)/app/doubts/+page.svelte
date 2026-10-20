<script lang="ts">
	import { ChevronRight, MessageCircleQuestion, MessageSquareText } from '@lucide/svelte';
	import { EmptyState, PageHeader, Tabs } from '#lib/components/ui';
	import AskDoubtButton from '#lib/features/doubts/components/AskDoubtButton.svelte';
	import { ago } from '#lib/features/courses/components/format';

	let { data } = $props();

	const tabs = $derived([
		{ value: '', label: 'All', href: '/app/doubts' },
		{ value: 'open', label: 'Waiting', href: '/app/doubts?status=open' },
		{ value: 'answered', label: 'Answered', href: '/app/doubts?status=answered', count: data.unread || undefined }
	]);
	const subtitle = $derived(
		data.unread ? `${data.unread} new ${data.unread === 1 ? 'answer' : 'answers'} from your teachers` : 'Stuck on a step? Ask a teacher.'
	);
</script>

<svelte:head><title>Doubts · UCI</title></svelte:head>

<div class="page-narrow pb-10">
	<PageHeader title="Doubts" {subtitle}>
		{#snippet actions()}<AskDoubtButton variant="primary" />{/snippet}
	</PageHeader>

	<div class="mb-4"><Tabs items={tabs} value={data.filter ?? ''} label="Doubt status" /></div>

	{#if data.page.items.length}
		<ul class="list rise" style="--i: 1">
			{#each data.page.items as d (d.id)}
				<li>
					<a class="list-row doubt" class:is-unread={d.unread} href="/app/doubts/{d.id}">
						<span class="leading-icon">{#if d.status === 'open'}<MessageCircleQuestion />{:else}<MessageSquareText />{/if}</span>
						<span class="grow min-w-0">
							<span class="title block line-clamp-2">{d.body}</span>
							<span class="tiny muted block mt-1 truncate">
								{#if d.unread}<strong class="new">New answer</strong>{:else}{d.status === 'open' ? 'Waiting' : 'Answered'}{/if}{` · ${ago(d.createdAt, data.now)}${d.context ? ` · ${d.context}` : ''}`}
							</span>
						</span>
						<ChevronRight class="chev" />
					</a>
				</li>
			{/each}
		</ul>
		{#if data.page.next}
			<div class="mt-4 text-center">
				<a class="btn btn-secondary" href="?{data.filter ? `status=${data.filter}&` : ''}cursor={encodeURIComponent(data.page.next)}">Older doubts</a>
			</div>
		{/if}
	{:else}
		<EmptyState
			icon={MessageCircleQuestion}
			title={data.filter === 'open' ? 'Nothing waiting' : data.filter === 'answered' ? 'No answers yet' : 'No doubts yet'}
			body="Ask about any lesson, question or topic. Add a photo of your working if it helps."
		>
			{#snippet action()}<AskDoubtButton variant="primary" />{/snippet}
		</EmptyState>
	{/if}
</div>

<style>
	.doubt {
		position: relative;
		align-items: flex-start;
	}
	.doubt:not(.is-unread) .title {
		font-weight: 500;
	}
	.new {
		color: hsl(var(--primary));
		font-weight: 600;
	}
	.doubt.is-unread::before {
		content: '';
		position: absolute;
		left: 0;
		top: 0.75rem;
		bottom: 0.75rem;
		width: 3px;
		border-radius: 0 3px 3px 0;
		background: hsl(var(--sun));
	}
</style>
