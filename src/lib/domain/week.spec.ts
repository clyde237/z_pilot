import { describe, expect, it } from 'vitest';
import {
	currentWeekStart,
	formatYearMonth,
	isoWeekOf,
	monthWeeks,
	parseYearMonth,
	reportingMonthOf,
	todayInTimeZone,
	weekDays,
	weekStartOf
} from './week';

describe('weekStartOf', () => {
	it('returns the Monday of the week for any day from Monday to Sunday', () => {
		expect(weekStartOf('2026-10-05')).toBe('2026-10-05');
		expect(weekStartOf('2026-10-07')).toBe('2026-10-05');
		expect(weekStartOf('2026-10-11')).toBe('2026-10-05');
	});

	it('crosses month and year boundaries', () => {
		expect(weekStartOf('2026-11-01')).toBe('2026-10-26');
		expect(weekStartOf('2027-01-01')).toBe('2026-12-28');
	});

	it('rejects malformed or impossible dates', () => {
		expect(() => weekStartOf('2026-02-30')).toThrow(RangeError);
		expect(() => weekStartOf('05/10/2026')).toThrow(RangeError);
	});
});

describe('todayInTimeZone', () => {
	it('uses the Africa/Douala day, not the UTC day', () => {
		// 23:30 UTC on Sunday is already 00:30 on Monday in Douala (UTC+1).
		const now = new Date('2026-10-11T23:30:00Z');
		expect(todayInTimeZone(now)).toBe('2026-10-12');
		expect(currentWeekStart(now)).toBe('2026-10-12');
	});
});

describe('isoWeekOf', () => {
	it('numbers weeks as ISO 8601 does', () => {
		expect(isoWeekOf('2026-10-05')).toEqual({ year: 2026, week: 41 });
	});

	it('handles week 53 and the first week of the next year', () => {
		expect(isoWeekOf('2026-12-28')).toEqual({ year: 2026, week: 53 });
		expect(isoWeekOf('2027-01-04')).toEqual({ year: 2027, week: 1 });
	});
});

describe('weekDays', () => {
	it('lists Monday to Sunday', () => {
		expect(weekDays('2026-10-05')).toEqual([
			'2026-10-05',
			'2026-10-06',
			'2026-10-07',
			'2026-10-08',
			'2026-10-09',
			'2026-10-10',
			'2026-10-11'
		]);
	});
});

describe('reportingMonthOf', () => {
	// Examples from CDC §5.2.
	it('attaches a week to the month containing its Wednesday', () => {
		expect(reportingMonthOf('2026-09-28')).toEqual({ year: 2026, month: 9 });
		expect(reportingMonthOf('2026-10-05')).toEqual({ year: 2026, month: 10 });
		expect(reportingMonthOf('2026-10-26')).toEqual({ year: 2026, month: 10 });
	});

	it('attaches a week to the next month when its Wednesday falls there', () => {
		// Monday 29 June, Wednesday 1 July.
		expect(reportingMonthOf('2026-06-29')).toEqual({ year: 2026, month: 7 });
	});

	it('attaches a week straddling two years to the right year', () => {
		expect(reportingMonthOf('2026-12-28')).toEqual({ year: 2026, month: 12 });
		expect(reportingMonthOf('2027-12-27')).toEqual({ year: 2027, month: 12 });
		// Wednesday 2025-12-31 → December 2025, although the week ends in 2026.
		expect(reportingMonthOf('2025-12-29')).toEqual({ year: 2025, month: 12 });
	});
});

describe('monthWeeks', () => {
	it('returns all weeks attached to October 2026 (S41 to S44) per CDC §5.2', () => {
		expect(monthWeeks(2026, 10)).toEqual(['2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26']);
	});

	it('includes S40 (2026-09-28) in September 2026 because its Wednesday is 30 September', () => {
		const septWeeks = monthWeeks(2026, 9);
		expect(septWeeks).toContain('2026-09-28');
		expect(septWeeks).toHaveLength(5);
	});

	it('rejects invalid month numbers', () => {
		expect(() => monthWeeks(2026, 0)).toThrow(RangeError);
		expect(() => monthWeeks(2026, 13)).toThrow(RangeError);
	});
});

describe('parseYearMonth and formatYearMonth', () => {
	it('parses and formats YYYY-MM correctly', () => {
		expect(parseYearMonth('2026-10')).toEqual({ year: 2026, month: 10 });
		expect(formatYearMonth(2026, 10)).toBe('2026-10');
		expect(formatYearMonth(2026, 4)).toBe('2026-04');
	});

	it('rejects invalid year-month formats', () => {
		expect(() => parseYearMonth('2026-13')).toThrow(RangeError);
		expect(() => parseYearMonth('invalid')).toThrow(RangeError);
	});
});
