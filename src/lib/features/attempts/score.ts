export type MarkedQuestion = {
	marksMilli: number;
	negativeMilli: number;
	correctIndex: number;
	selected: number | null;
};

export type Score = {
	awarded: number;
	max: number;
	correct: number;
	wrong: number;
	unattempted: number;
	/** 1000 = 100.0% */
	percentageTenths: number;
	accuracyTenths: number;
};

export function scoreAttempt(questions: MarkedQuestion[]): Score {
	let awarded = 0;
	let max = 0;
	let correct = 0;
	let wrong = 0;
	let unattempted = 0;
	for (const question of questions) {
		max += question.marksMilli;
		if (question.selected == null) {
			unattempted += 1;
			continue;
		}
		if (question.selected === question.correctIndex) {
			correct += 1;
			awarded += question.marksMilli;
		} else {
			wrong += 1;
			awarded -= question.negativeMilli;
		}
	}
	const attempted = correct + wrong;
	return {
		awarded,
		max,
		correct,
		wrong,
		unattempted,
		percentageTenths: max === 0 ? 0 : Math.round((awarded / max) * 1000),
		accuracyTenths: attempted === 0 ? 0 : Math.round((correct / attempted) * 1000)
	};
}

/** 1000 milli-marks = 1 mark. */
export function formatMarks(milli: number) {
	return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(milli / 1000);
}

/** 1000 tenths = 100.0%. */
export function formatPercent(tenths: number) {
	return `${(tenths / 10).toFixed(1)}%`;
}

export function formatPaise(paise: number) {
	return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(
		paise / 100
	);
}

export function formatDuration(seconds: number) {
	const m = Math.floor(seconds / 60);
	const s = seconds % 60;
	return `${m}:${String(s).padStart(2, '0')}`;
}
