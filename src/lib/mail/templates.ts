import type { NotificationKind } from "@/lib/types";
import { getAppBaseUrl } from "@/lib/missive/env";
import { TEBI_IT_SIGNATURE_HTML } from "@/lib/mail/tebi-it-signature";

export type MailContent = {
  subject: string;
  html: string;
};

type TemplateInput = {
  kind: NotificationKind | string;
  title: string;
  body: string | null;
  ticketId: string | null;
  ticketnummer?: string | null;
  onderwerp?: string | null;
  /** Existing root subject for Re: threading. */
  rootSubject?: string | null;
};

/** Build subject + HTML for a queued notification email. */
export function buildNotificationEmail(input: TemplateInput): MailContent {
  const base = getAppBaseUrl();
  const ticketUrl = input.ticketId ? `${base}/ticket/${input.ticketId}` : base;
  const label =
    input.ticketnummer && input.onderwerp
      ? `${input.ticketnummer} · ${input.onderwerp}`
      : input.ticketnummer || input.onderwerp || "Ticket";

  const root =
    input.rootSubject?.trim() ||
    (input.kind === "ticket_created"
      ? `[${input.ticketnummer ?? "Ticket"}] Ontvangstbevestiging: ${input.onderwerp ?? "nieuw ticket"}`
      : `[${input.ticketnummer ?? "Ticket"}] ${input.onderwerp ?? "Update"}`);

  const subject =
    input.kind === "ticket_created"
      ? root
      : root.toLowerCase().startsWith("re:")
        ? root
        : `Re: ${root}`;

  const intro =
    input.kind === "ticket_created"
      ? "We hebben je IT-verzoek ontvangen:"
      : input.kind === "ticket_status_changed"
        ? "De status van een ticket is gewijzigd:"
        : input.kind === "ticket_comment"
          ? "Er is een nieuwe update op een ticket:"
          : "Er is een update in het Ticketportaal:";

  // Drop body when it only repeats the ticket label (legacy notifications).
  const bodyText = mailBodyWithoutTicketLabel(input.body, label);

  const html = `
<div style="font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:#1a1a1a;">
  <p style="margin:0 0 12px;">${escapeHtml(intro)}</p>
  <p style="margin:0 0 4px;"><strong>${escapeHtml(label)}</strong></p>
  <p style="margin:0 0 12px;">${escapeHtml(input.title)}</p>
  ${
    bodyText
      ? `<p style="margin:0 0 16px;color:#444;">${escapeHtml(bodyText)}</p>`
      : ""
  }
  <p style="margin:0 0 20px;">
    <a href="${escapeAttr(ticketUrl)}" style="display:inline-block;padding:10px 14px;background:#111;color:#fff;text-decoration:none;border-radius:6px;">
      Open ticket
    </a>
  </p>
  <!-- Missive personal signature disabled; embed fixed Tebi IT signature instead. -->
  <div style="margin-top:24px;">
    ${TEBI_IT_SIGNATURE_HTML}
  </div>
  <p style="margin:12px 0 0;font-size:12px;color:#777;">
    Tebi Ticketportaal · je ontvangt deze mail omdat je melder of volger bent.
  </p>
</div>`.trim();

  return { subject, html };
}

/**
 * Strip a leading “TP-… · onderwerp:” / exact label so the mail does not
 * repeat the ticket line already shown above the notification title.
 */
function mailBodyWithoutTicketLabel(
  body: string | null | undefined,
  label: string,
): string | null {
  if (!body) return null;
  const trimmed = body.trim();
  if (!trimmed || trimmed === label) return null;
  const prefix = `${label}:`;
  if (trimmed.startsWith(prefix)) {
    const rest = trimmed.slice(prefix.length).trim();
    return rest || null;
  }
  // Legacy status bodies: “TP-… · onderwerp (Nieuw → …)”
  const wrapped = `${label} (`;
  if (trimmed.startsWith(wrapped) && trimmed.endsWith(")")) {
    const rest = trimmed.slice(wrapped.length, -1).trim();
    return rest || null;
  }
  return trimmed;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(value: string): string {
  return escapeHtml(value).replace(/'/g, "&#39;");
}
