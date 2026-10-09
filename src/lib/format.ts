import { TIME_ZONE } from '#lib/domain/week.js';

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
