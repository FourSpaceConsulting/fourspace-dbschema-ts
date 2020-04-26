export function emptyString(s: string) {
    return s == null || s.trim() === '';
}
export function emptyArray(a: readonly any[]) {
    return a == null || a.length === 0;
}
export function toKeysBySample<T>(names: T): string[] {
    return Object.keys(names) as (keyof T & string)[];
}
