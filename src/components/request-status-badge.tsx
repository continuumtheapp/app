import type { RequestStatus } from "@/lib/requests";

export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  const styles: Record<string, [string, string]> = {
    open: ["Open", "bg-accent-soft text-accent-ink"],
    found: ["Found a place", "bg-paper text-ink-soft border border-line"],
    closed: ["Closed", "bg-paper text-ink-soft border border-line"],
    expired: ["Dates have passed", "bg-flexible-soft text-flexible"],
  };
  const [label, cls] = styles[status] ?? [status, "bg-paper text-ink-soft"];
  return <span className={`badge shrink-0 ${cls}`}>{label}</span>;
}
