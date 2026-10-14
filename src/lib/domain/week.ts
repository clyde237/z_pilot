import { TZDate } from '@date-fns/tz';
import { addDays, format, getISOWeek, getISOWeekYear, isValid, startOfISOWeek } from 'date-fns';

/** RG-01: the department's time zone, used to decide what "today" is. */
export const TIME_ZONE = 'Africa/Douala';

/** Calendar date as stored in the database (`date` columns): `YYYY-MM-DD`. */
export type IsoDate = string;

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

// Calendar dates carry no time zone: computing on them in UTC keeps the result
// independent of the server's local zone.
export function parseIsoDate(value: IsoDate): TZDate {
	const match = ISO_DATE_PATTERN.exec(value);
	const date = match ? new TZDate(+match[1], +match[2] - 1, +match[3], 'UTC') : null;
	if (!date || !isValid(date) || formatIsoDate(date) !== value) {
		throw new RangeError(`Invalid calendar date: ${value}`);
	}
	return date;
}

export function formatIsoDate(date: Date): IsoDate {
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

/** Shifts a week start by a given number of days (e.g. +7 for next week, -7 for previous week). */
export function shiftWeek(weekStart: IsoDate, daysDelta: number): IsoDate {
	return formatIsoDate(addDays(parseIsoDate(weekStartOf(weekStart)), daysDelta));
}

/**
 * Returns all Monday week starts belonging to a given calendar month (CDC §5.2).
 * A week belongs to the month that contains its Wednesday.
 */
export function monthWeeks(year: number, month: number): IsoDate[] {
	if (month < 1 || month > 12) {
		throw new RangeError(`Invalid month: ${month}`);
	}
	const firstDay = new TZDate(year, month - 1, 1, 'UTC');
	let candidate = weekStartOf(formatIsoDate(firstDay));

	const targetMonth = reportingMonthOf(candidate);
	if (targetMonth.year < year || (targetMonth.year === year && targetMonth.month < month)) {
		candidate = shiftWeek(candidate, 7);
	}

	const weeks: IsoDate[] = [];
	while (true) {
		const rep = reportingMonthOf(candidate);
		if (rep.year === year && rep.month === month) {
			weeks.push(candidate);
			candidate = shiftWeek(candidate, 7);
		} else {
			break;
		}
	}

	return weeks;
}

/** Formats month parameter as YYYY-MM. */
export function formatYearMonth(year: number, month: number): string {
	return `${year}-${String(month).padStart(2, '0')}`;
}

/** Parses month parameter string `YYYY-MM`. */
export function parseYearMonth(param: string): { year: number; month: number } {
	const match = /^(\d{4})-(\d{2})$/.exec(param);
	if (!match) throw new RangeError(`Invalid year-month: ${param}`);
	const year = Number(match[1]);
	const month = Number(match[2]);
	if (month < 1 || month > 12) throw new RangeError(`Invalid month: ${month}`);
	return { year, month };
}

/** Returns ISO day of week: 1 (Monday) to 7 (Sunday). */
export function isoDayOfWeek(date: IsoDate): number {
	const d = parseIsoDate(date);
	const day = d.getDay();
	return day === 0 ? 7 : day;
}

/**
 * Checks if `date` is the last working day of its ISO week (EF-NOT-03).
 * Defaults to Friday when workingDays is standard [1, 2, 3, 4, 5].
 */
export function isLastWorkingDayOfWeek(date: IsoDate, workingDays: number[]): boolean {
	const currentDay = isoDayOfWeek(date);
	if (!workingDays.includes(currentDay)) return false;
	const maxWorkingDay = Math.max(...workingDays);
	return currentDay === maxWorkingDay;
}

/**
 * Checks if `date` is the last working day of its calendar month (EF-NOT-03).
 */
export function isLastWorkingDayOfMonth(date: IsoDate, workingDays: number[]): boolean {
	const d = parseIsoDate(date);
	const currentDay = isoDayOfWeek(date);
	if (!workingDays.includes(currentDay)) return false;

	const currentMonth = d.getMonth();
	let cursor = addDays(d, 1);
	while (cursor.getMonth() === currentMonth) {
		const isoDay = cursor.getDay() === 0 ? 7 : cursor.getDay();
		if (workingDays.includes(isoDay)) {
			return false;
		}
		cursor = addDays(cursor, 1);
	}
	return true;
}
