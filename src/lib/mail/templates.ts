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

  // Drop body when it only repeats the ticket label (legacy notifications).
  const bodyText = mailBodyWithoutTicketLabel(input.body, label);

  const mainHtml =
    input.kind === "ticket_created"
      ? createdMailBody(label, bodyText)
      : updateMailBody(input.title, label, bodyText);

  const html = `
<div style="font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:#1a1a1a;">
  ${mainHtml}
  <!-- Extra blank line between content and the Open ticket button. -->
  <p style="margin:0 0 20px;">&nbsp;</p>
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
 * Ontvangstbevestiging: short intro + ticket label (no redundant title line).
 */
function createdMailBody(label: string, bodyText: string | null): string {
  return `
  <p style="margin:0 0 12px;">We hebben je IT-verzoek ontvangen:</p>
  <p style="margin:0 0 12px;"><strong>${escapeHtml(label)}</strong></p>
  ${
    bodyText
      ? `<p style="margin:0;color:#444;">${escapeHtml(bodyText)}</p>`
      : ""
  }`.trim();
}

/**
 * Update mails: “{naam} plaatste een update op TP-… · onderwerp:” then body.
 */
function updateMailBody(
  title: string,
  label: string,
  bodyText: string | null,
): string {
  const headline = `${title} op ${label}:`;
  // Both lines at 17px (previous larger headline size); blank line between them.
  return `
  <p style="margin:0 0 12px;font-size:17px;line-height:1.4;">${escapeHtml(headline)}</p>
  ${
    bodyText
      ? `<p style="margin:0 0 12px;">&nbsp;</p>
  <p style="margin:0;color:#1a1a1a;font-size:17px;line-height:1.4;"><strong>${escapeHtml(bodyText)}</strong></p>`
      : ""
  }`.trim();
}

/**
 * Strip a leading “TP-… · onderwerp:” / exact label so the mail does not
 * repeat the ticket line already shown in the headline.
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
