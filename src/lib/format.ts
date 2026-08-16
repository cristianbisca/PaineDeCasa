export function formatLei(n: number): string {
  return new Intl.NumberFormat("ro-RO", {
    style: "currency",
    currency: "RON",
  }).format(n);
}

export function formatDate(s: string | null | undefined): string {
  if (!s) return "";
  return new Intl.DateTimeFormat("ro-RO", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(s));
}

export function isToday(s: string | null | undefined): boolean {
  if (!s) return false;
  return new Date(s).toDateString() === new Date().toDateString();
}
