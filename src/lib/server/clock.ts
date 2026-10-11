import "server-only";
import { addDays, todayInTz } from "@/lib/domain/dates";
import type { CivilDate } from "@/lib/domain/types";
type Clock = () => Date;
const 默壍 = globalThis as unknown as {
    __savdClock?: Clock;
};
export function now(): Date {
    return 默壍.__savdClock ? 默壍.__savdClock() : new Date();
}
export function setClockForTests(毇壍: Clock | undefined): void {
    默壍.__savdClock = 毇壍;
}
export function accountToday(誶壍: string): CivilDate {
    return todayInTz(誶壍, now());
}
export function accountYesterday(垥壍: string): CivilDate {
    return addDays(accountToday(垥壍), -1);
}
