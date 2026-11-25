import {
  getMissiveApiToken,
  getMissiveFromEmail,
  getMissiveFromName,
  isMissiveConfigured,
} from "@/lib/missive/env";

const MISSIVE_API = "https://public.missiveapp.com/v1";

export type MissiveSendInput = {
  toEmail: string;
  toName?: string | null;
  subject: string;
  /** HTML body. */
  html: string;
  /** Existing Missive conversation to reply into (per-ticket per-user thread). */
  conversationId?: string | null;
};

export type MissiveSendResult =
  | { ok: true; draftId: string | null; conversationId: string | null }
  | { ok: false; error: string };

/**
 * Send (or schedule) an email via Missive Drafts API.
 * https://missiveapp.com/help/api-documentation/rest-endpoints
 */
export async function sendMissiveEmail(
  input: MissiveSendInput,
): Promise<MissiveSendResult> {
  if (!isMissiveConfigured()) {
    return { ok: false, error: "Missive is niet geconfigureerd." };
  }

  const token = getMissiveApiToken()!;
  const fromEmail = getMissiveFromEmail()!;
  const fromName = getMissiveFromName();

  const draft: Record<string, unknown> = {
    subject: input.subject,
    body: input.html,
    send: true,
    // Avoid the API-token user's personal Missive signature on it@tebi.nl;
    // our HTML template carries a generic Ticketportaal footer instead.
    add_default_signature: false,
    from_field: { address: fromEmail, name: fromName },
    to_fields: [
      {
        address: input.toEmail,
        ...(input.toName ? { name: input.toName } : {}),
      },
    ],
  };

  if (input.conversationId) {
    draft.conversation = input.conversationId;
  }

  try {
    const response = await fetch(`${MISSIVE_API}/drafts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ drafts: draft }),
    });

    const raw = await response.text();
    let parsed: unknown = null;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      parsed = null;
    }

    if (!response.ok) {
      const message =
        typeof parsed === "object" &&
        parsed &&
        "error" in parsed &&
        typeof (parsed as { error: unknown }).error === "string"
          ? (parsed as { error: string }).error
          : raw.slice(0, 300) || `HTTP ${response.status}`;
      return { ok: false, error: message };
    }

    return {
      ok: true,
      draftId: extractDraftId(parsed),
      conversationId: extractConversationId(parsed) ?? input.conversationId ?? null,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Missive-aanroep mislukt.",
    };
  }
}

function extractDraftId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const drafts = (payload as { drafts?: unknown }).drafts;
  if (Array.isArray(drafts) && drafts[0] && typeof drafts[0] === "object") {
    const id = (drafts[0] as { id?: unknown }).id;
    return typeof id === "string" ? id : null;
  }
  if (drafts && typeof drafts === "object") {
    const id = (drafts as { id?: unknown }).id;
    return typeof id === "string" ? id : null;
  }
  return null;
}

function extractConversationId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const root = payload as Record<string, unknown>;

  if (typeof root.conversation === "string") return root.conversation;

  const drafts = root.drafts;
  if (Array.isArray(drafts) && drafts[0] && typeof drafts[0] === "object") {
    const d = drafts[0] as Record<string, unknown>;
    if (typeof d.conversation === "string") return d.conversation;
    if (d.conversation && typeof d.conversation === "object") {
      const id = (d.conversation as { id?: unknown }).id;
      if (typeof id === "string") return id;
    }
  }
  if (drafts && typeof drafts === "object" && !Array.isArray(drafts)) {
    const d = drafts as Record<string, unknown>;
    if (typeof d.conversation === "string") return d.conversation;
  }

  const conversations = root.conversations;
  if (Array.isArray(conversations) && conversations[0] && typeof conversations[0] === "object") {
    const id = (conversations[0] as { id?: unknown }).id;
    if (typeof id === "string") return id;
  }

  return null;
}
