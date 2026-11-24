import type { TicketPriority, TicketStatus } from "@/lib/types";
import { PRIORITY_LABEL, STATUS_LABEL } from "@/lib/labels";

/** CSS class per status — one distinct soft/ink pair each (see globals.css). */
const STATUS_BADGE_CLASS: Record<TicketStatus, string> = {
  nieuw: "badge-status-nieuw",
  ingepland: "badge-status-ingepland",
  in_behandeling: "badge-status-in-behandeling",
  wacht_op_melder: "badge-status-wacht-op-melder",
  wacht_op_publicatie: "badge-status-wacht-op-publicatie",
  afgerond: "badge-status-afgerond",
  afgewezen: "badge-status-afgewezen",
};

/** Compact status pill with a unique color per ticket status. */
export function StatusBadge({ status }: { status: TicketStatus }) {
  return (
    <span className={`badge ${STATUS_BADGE_CLASS[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: TicketPriority }) {
  const tone = priority === "spoed" ? "badge-spoed" : "badge";
  return <span className={`badge ${tone}`}>{PRIORITY_LABEL[priority]}</span>;
}
