<script lang="ts">
	// Tests that belong to this course only. They are not listed in the Tests section.
	import { enhance } from '$app/forms';
	import { withToast } from './submit';

	type Row = { id: string; title: string; status: string; questionCount: number; durationMin: number };
	let { tests }: { tests: Row[] } = $props();
	let title = $state('');
	let minutes = $state('30');
	let busy = $state(false);
</script>

<section class="card card-pad stack" aria-label="Course tests">
	<div>
		<h2 class="section-title">Course tests</h2>
		<p class="muted small mt-1">Students open these from this course. They do not show in the Tests section.</p>
	</div>
	<form
		method="POST"
		action="?/addTest"
		class="stack-sm"
		use:enhance={withToast('Test added to this course', () => {
			title = '';
			minutes = '30';
		}, (b) => (busy = b))}
	>
		<div class="form-row">
			<div class="field grow">
				<label class="label" for="course-test-title">Test name</label>
				<input id="course-test-title" class="input" name="title" bind:value={title} maxlength="200" required placeholder="Chapter 1 practice" />
			</div>
			<div class="field">
				<label class="label" for="course-test-min">Minutes</label>
				<input id="course-test-min" class="input font-mono tabular" name="durationMin" bind:value={minutes} type="number" min="1" max="600" />
			</div>
		</div>
		<button class="btn btn-primary" disabled={busy || !title.trim()}>{busy ? 'Adding…' : 'Add test'}</button>
	</form>
	{#if tests.length}
		<ul class="tests">
			{#each tests as t (t.id)}
				<li>
					<div class="min-w-0">
						<p class="font-semibold">{t.title}</p>
						<p class="tiny muted">{t.status} · {t.questionCount} questions · {t.durationMin} min</p>
					</div>
					<div class="acts">
						<a class="btn btn-secondary btn-sm" href="/admin/tests/{t.id}/questions">Questions</a>
						{#if t.status === 'published'}
							<form method="POST" action="?/unpublishTest" use:enhance={withToast('Test moved to draft')}>
								<input type="hidden" name="testId" value={t.id} />
								<button class="btn btn-ghost btn-sm">Unpublish</button>
							</form>
						{:else}
							<form method="POST" action="?/publishTest" use:enhance={withToast('Test published on this course')}>
								<input type="hidden" name="testId" value={t.id} />
								<button class="btn btn-ghost btn-sm">Publish</button>
							</form>
						{/if}
						<form method="POST" action="?/deleteTest" use:enhance={withToast('Test removed')}>
							<input type="hidden" name="testId" value={t.id} />
							<button class="btn btn-ghost btn-sm text-danger">Remove</button>
						</form>
					</div>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="muted small">No tests in this course yet.</p>
	{/if}
</section>

<style>
	.tests {
		display: grid;
		gap: 0.75rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.tests li {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.6rem;
		padding-top: 0.75rem;
		border-top: 1px solid hsl(var(--border));
	}
	.acts {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}
</style>
