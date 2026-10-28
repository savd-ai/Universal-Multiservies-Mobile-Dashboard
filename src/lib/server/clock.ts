import "server-only";
import { addDays, todayInTz } from "@/lib/domain/dates";
import type { CivilDate } from "@/lib/domain/types";
type Clock = () => Date;
const g = globalThis as unknown as {
    __savdClock?: Clock;
};
export function now(): Date {
    return g.__savdClock ? g.__savdClock() : new Date();
}
export function setClockForTests(clock: Clock | undefined): void {
    g.__savdClock = clock;
}
export function accountToday(timeZone: string): CivilDate {
    return todayInTz(timeZone, now());
}
export function accountYesterday(timeZone: string): CivilDate {
    return addDays(accountToday(timeZone), -1);
}
