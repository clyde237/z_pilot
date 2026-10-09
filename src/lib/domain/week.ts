import { TZDate } from '@date-fns/tz';
import { addDays, format, getISOWeek, getISOWeekYear, isValid, startOfISOWeek } from 'date-fns';

/** RG-01: the department's time zone, used to decide what "today" is. */
export const TIME_ZONE = 'Africa/Douala';

/** Calendar date as stored in the database (`date` columns): `YYYY-MM-DD`. */
export type IsoDate = string;

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

// Calendar dates carry no time zone: computing on them in UTC keeps the result
// independent of the server's local zone.
function parseIsoDate(value: IsoDate): TZDate {
	const match = ISO_DATE_PATTERN.exec(value);
	const date = match ? new TZDate(+match[1], +match[2] - 1, +match[3], 'UTC') : null;
	if (!date || !isValid(date) || formatIsoDate(date) !== value) {
		throw new RangeError(`Invalid calendar date: ${value}`);
	}
	return date;
}

function formatIsoDate(date: Date): IsoDate {
	return format(date, 'yyyy-MM-dd');
}

/** Today's date in the department's time zone. */
export function todayInTimeZone(now: Date = new Date()): IsoDate {
	return formatIsoDate(new TZDate(now, TIME_ZONE));
}

/** Monday of the ISO week containing `day` — the `week_start` key of every weekly record. */
export function weekStartOf(day: IsoDate): IsoDate {
	return formatIsoDate(startOfISOWeek(parseIsoDate(day)));
}

export function currentWeekStart(now: Date = new Date()): IsoDate {
	return weekStartOf(todayInTimeZone(now));
}

/** The seven days of the week, Monday to Sunday. */
export function weekDays(weekStart: IsoDate): IsoDate[] {
	const monday = parseIsoDate(weekStartOf(weekStart));
	return Array.from({ length: 7 }, (_, offset) => formatIsoDate(addDays(monday, offset)));
}

/** ISO week number and week-numbering year, e.g. `{ year: 2026, week: 41 }` for S41. */
export function isoWeekOf(weekStart: IsoDate): { year: number; week: number } {
	const day = parseIsoDate(weekStart);
	return { year: getISOWeekYear(day), week: getISOWeek(day) };
}

/**
 * Month a week is reported in (CDC §5.2): the month containing its Wednesday,
 * i.e. the month holding at least three of its five working days.
 */
export function reportingMonthOf(weekStart: IsoDate): { year: number; month: number } {
	const wednesday = addDays(parseIsoDate(weekStartOf(weekStart)), 2);
	return { year: wednesday.getFullYear(), month: wednesday.getMonth() + 1 };
}
