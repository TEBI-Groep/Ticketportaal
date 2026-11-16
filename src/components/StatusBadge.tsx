import type { TicketPriority, TicketStatus } from "@/lib/types";
import { PRIORITY_LABEL, STATUS_LABEL } from "@/lib/labels";

/** Compact status pill; spoed gets the only strong semantic color. */
export function StatusBadge({ status }: { status: TicketStatus }) {
  const tone =
    status === "afgerond"
      ? "badge-ok"
      : status === "afgewezen"
        ? "badge-warn"
        : status === "wacht_op_melder"
          ? "badge-warn"
          : "badge-brand";

  return <span className={`badge ${tone}`}>{STATUS_LABEL[status]}</span>;
}

export function PriorityBadge({ priority }: { priority: TicketPriority }) {
  const tone = priority === "spoed" ? "badge-spoed" : "badge";
  return <span className={`badge ${tone}`}>{PRIORITY_LABEL[priority]}</span>;
}
