/** Mail preference keys aligned with notification kinds. */

export type MailPreferenceKey =
  | "emailTicketCreated"
  | "emailTicketStatusChanged"
  | "emailTicketComment";

export type NotificationPreferences = {
  emailTicketCreated: boolean;
  emailTicketStatusChanged: boolean;
  emailTicketComment: boolean;
};

/** Defaults when the user has never saved voorkeuren. */
export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  emailTicketCreated: true,
  emailTicketStatusChanged: true,
  emailTicketComment: true,
};

export const MAIL_PREFERENCE_FIELDS: Array<{
  key: MailPreferenceKey;
  kind: "ticket_created" | "ticket_status_changed" | "ticket_comment";
  label: string;
  hint: string;
}> = [
  {
    key: "emailTicketCreated",
    kind: "ticket_created",
    label: "Ontvangstbevestiging",
    hint: "Mail wanneer jij een nieuw ticket aanmaakt.",
  },
  {
    key: "emailTicketStatusChanged",
    kind: "ticket_status_changed",
    label: "Statuswijzigingen",
    hint: "Mail wanneer de status van een ticket waarop jij volgt bent wijzigt.",
  },
  {
    key: "emailTicketComment",
    kind: "ticket_comment",
    label: "Updates & vragen",
    hint: "Mail wanneer er een nieuw bericht in Updates & vragen wordt geplaatst.",
  },
];

/** Whether this notification kind should send mail for these prefs. */
export function prefersEmailForKind(
  prefs: NotificationPreferences,
  kind: string,
): boolean {
  switch (kind) {
    case "ticket_created":
      return prefs.emailTicketCreated;
    case "ticket_status_changed":
      return prefs.emailTicketStatusChanged;
    case "ticket_comment":
      return prefs.emailTicketComment;
    default:
      return false;
  }
}
