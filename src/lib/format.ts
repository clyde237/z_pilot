import { isoWeekOf, TIME_ZONE, weekDays } from '#lib/domain/week.js';

// CDC §10: French interface, dd/mm/yyyy dates, Africa/Douala time zone.

const timeFormat = new Intl.DateTimeFormat('fr-FR', { timeStyle: 'short', timeZone: TIME_ZONE });
const dateFormat = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeZone: TIME_ZONE });
const dateTimeFormat = new Intl.DateTimeFormat('fr-FR', {
	dateStyle: 'short',
	timeStyle: 'short',
	timeZone: TIME_ZONE
});

/** 14:05 */
export function formatTime(date: Date): string {
	return timeFormat.format(date);
}

/** 09/10/2026 */
export function formatDate(date: Date): string {
	return dateFormat.format(date);
}

/** 09/10/2026 14:05 */
export function formatDateTime(date: Date): string {
	return dateTimeFormat.format(date);
}

/** "Clyde Fanche" → "CF" */
export function initialsOf(fullName: string): string {
	return fullName
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((part) => part[0].toUpperCase())
		.join('');
}

const MONTH_NAMES_FR = [
	'janvier',
	'février',
	'mars',
	'avril',
	'mai',
	'juin',
	'juillet',
	'août',
	'septembre',
	'octobre',
	'novembre',
	'décembre'
];

/** Formats a week range, e.g. "Semaine 41 · du 5 au 11 octobre 2026" (CDC §9). */
export function formatWeekLabel(weekStart: string): string {
	const days = weekDays(weekStart);
	const { week } = isoWeekOf(weekStart);

	const [monY, monM, monD] = days[0].split('-').map(Number);
	const [sunY, sunM, sunD] = days[6].split('-').map(Number);

	const monMonth = MONTH_NAMES_FR[monM - 1];
	const sunMonth = MONTH_NAMES_FR[sunM - 1];

	let range: string;
	if (monY !== sunY) {
		range = `du ${monD} ${monMonth} ${monY} au ${sunD} ${sunMonth} ${sunY}`;
	} else if (monM !== sunM) {
		range = `du ${monD} ${monMonth} au ${sunD} ${sunMonth} ${sunY}`;
	} else {
		range = `du ${monD} au ${sunD} ${sunMonth} ${sunY}`;
	}

	return `Semaine ${week} · ${range}`;
}
