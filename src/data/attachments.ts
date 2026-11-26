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

function mapAttachment(
  row: {
    id: string;
    ticket_id: string;
    uploaded_by: string;
    storage_path: string;
    file_name: string;
    mime_type: string | null;
    byte_size: number | null;
    kind: AttachmentKind;
    created_at: string;
    profiles: { naam: string } | { naam: string }[] | null;
  },
  url?: string,
): TicketAttachment {
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
    url,
  };
}

/** List attachments for a ticket, with signed URLs for preview/download. */
export async function getAttachmentsForTicket(
  ticketId: string,
): Promise<TicketAttachment[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("ticket_attachments")
      .select(
        "id, ticket_id, uploaded_by, storage_path, file_name, mime_type, byte_size, kind, created_at, profiles!ticket_attachments_uploaded_by_fkey ( naam )",
      )
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true });
    if (error || !data) return [];

    const rows = data as unknown as Array<Parameters<typeof mapAttachment>[0]>;
    const withUrls = await Promise.all(
      rows.map(async (row) => {
        const { data: signed } = await supabase.storage
          .from(ATTACHMENTS_BUCKET)
          .createSignedUrl(row.storage_path, SIGNED_URL_SECONDS);
        return mapAttachment(row, signed?.signedUrl);
      }),
    );
    return withUrls;
  } catch {
    return [];
  }
}
