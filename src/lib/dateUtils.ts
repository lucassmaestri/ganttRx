import { addDays, differenceInCalendarDays, startOfDay } from 'date-fns';

export function dateToPixel(date: Date, viewStart: Date, columnWidth: number): number {
  const days = differenceInCalendarDays(startOfDay(date), startOfDay(viewStart));
  return days * columnWidth;
}

export function pixelToDate(px: number, viewStart: Date, columnWidth: number): Date {
  const days = Math.round(px / columnWidth);
  return addDays(startOfDay(viewStart), days);
}

export function snapToDay(px: number, columnWidth: number): number {
  return Math.round(px / columnWidth) * columnWidth;
}

export function generateDayColumns(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  let cur = startOfDay(start);
  const endDay = startOfDay(end);
  while (cur <= endDay) {
    days.push(cur);
    cur = addDays(cur, 1);
  }
  return days;
}

export function isWeekend(date: Date): boolean {
  const d = date.getDay();
  return d === 0 || d === 6;
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatDateShort(date: Date): string {
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}
