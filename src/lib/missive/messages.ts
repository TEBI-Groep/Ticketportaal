import { getMissiveApiToken } from "@/lib/missive/env";

const MISSIVE_API = "https://public.missiveapp.com/v1";

export type MissiveMessage = {
  id: string;
  subject?: string | null;
  preview?: string | null;
  body?: string | null;
  email_message_id?: string | null;
  in_reply_to?: string[] | null;
  from_field?: { name?: string | null; address?: string | null } | null;
};

/**
 * Fetch full message (includes HTML body) by Missive message id.
 * https://missiveapp.com/docs/developers/rest-api/endpoints#get-a-message
 */
export async function fetchMissiveMessage(
  messageId: string,
): Promise<MissiveMessage | null> {
  const token = getMissiveApiToken();
  if (!token || !messageId) return null;

  try {
    const response = await fetch(
      `${MISSIVE_API}/messages/${encodeURIComponent(messageId)}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      },
    );
    if (!response.ok) return null;
    const parsed = (await response.json()) as {
      messages?: MissiveMessage | MissiveMessage[];
    };
    const messages = parsed.messages;
    if (Array.isArray(messages)) return messages[0] ?? null;
    if (messages && typeof messages === "object") return messages;
    return null;
  } catch {
    return null;
  }
}
