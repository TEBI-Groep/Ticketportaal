import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { one } from "@/lib/supabase/embed";
import type { AttachmentKind, TicketAttachment } from "@/lib/types";
import { ATTACHMENTS_BUCKET } from "@/lib/attachment-rules";

export {
  ATTACHMENTS_BUCKET,
  ALLOWED_ATTACHMENT_MIME,
  EXCEL_CSV_MIME,
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENT_LABEL,
  attachmentKindFromMime,
  resolveAttachmentMime,
  sanitizeFileName,
  validateAttachmentFile,
} from "@/lib/attachment-rules";

const SIGNED_URL_SECONDS = 60 * 60;

type AttachmentRow = {
  id: string;
  ticket_id: string;
  uploaded_by: string;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  byte_size: number | null;
  kind: AttachmentKind;
  created_at: string;
  comment_id?: string | null;
  profiles: { naam: string } | { naam: string }[] | null;
};

function mapAttachment(row: AttachmentRow, url?: string): TicketAttachment {
  const profile = one(row.profiles);
  return {
    id: row.id,
    ticketId: row.ticket_id,
    uploadedBy: row.uploaded_by,
    uploaderNaam: profile?.naam ?? "Gebruiker",
    storagePath: row.storage_path,
    fileName: row.file_name,
    mimeType: row.mime_type,
    byteSize: row.byte_size,
    kind: row.kind,
    createdAt: row.created_at.slice(0, 10),
    commentId: row.comment_id ?? null,
    url,
  };
}

const ATTACHMENT_SELECT =
  "id, ticket_id, uploaded_by, storage_path, file_name, mime_type, byte_size, kind, created_at, comment_id, profiles!ticket_attachments_uploaded_by_fkey ( naam )";

async function withSignedUrls(
  rows: AttachmentRow[],
): Promise<TicketAttachment[]> {
  if (rows.length === 0) return [];
  const supabase = await createClient();
  return Promise.all(
    rows.map(async (row) => {
      const { data: signed } = await supabase.storage
        .from(ATTACHMENTS_BUCKET)
        .createSignedUrl(row.storage_path, SIGNED_URL_SECONDS);
      return mapAttachment(row, signed?.signedUrl);
    }),
  );
}

/**
 * Ticket-level bijlagen (Bijlagen section).
 * Comment-linked files are shown under Updates & vragen instead.
 */
export async function getAttachmentsForTicket(
  ticketId: string,
): Promise<TicketAttachment[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("ticket_attachments")
      .select(ATTACHMENT_SELECT)
      .eq("ticket_id", ticketId)
      .is("comment_id", null)
      .order("created_at", { ascending: true });
    if (error || !data) return [];
    return withSignedUrls(data as unknown as AttachmentRow[]);
  } catch {
    return [];
  }
}

/** Bijlagen linked to specific Updates & vragen comments. */
export async function getAttachmentsForComments(
  ticketId: string,
  commentIds: string[],
): Promise<TicketAttachment[]> {
  if (!isSupabaseConfigured() || commentIds.length === 0) return [];
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("ticket_attachments")
      .select(ATTACHMENT_SELECT)
      .eq("ticket_id", ticketId)
      .in("comment_id", commentIds)
      .order("created_at", { ascending: true });
    if (error || !data) return [];
    return withSignedUrls(data as unknown as AttachmentRow[]);
  } catch {
    return [];
  }
}
