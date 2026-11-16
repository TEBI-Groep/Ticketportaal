import Link from "next/link";

/** Fallback when a mock ticket id does not exist. */
export default function TicketNotFound() {
  return (
    <div className="page">
      <div className="empty-state">
        <p>Dit ticket bestaat niet (of nog niet) in de demodata.</p>
        <Link href="/ranglijst" className="btn btn-primary">
          Naar ranglijst
        </Link>
      </div>
    </div>
  );
}
