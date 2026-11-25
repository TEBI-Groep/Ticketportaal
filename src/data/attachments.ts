import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { one } from "@/lib/supabase/embed";
import type { AttachmentKind, TicketAttachment } from "@/lib/types";

export const ATTACHMENTS_BUCKET = "ticket-attachments";
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

/** Excel / CSV MIME types accepted as ticket bijlagen. */
export const EXCEL_CSV_MIME = {
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xls: "application/vnd.ms-excel",
  csv: "text/csv",
} as const;

export const ALLOWED_ATTACHMENT_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  EXCEL_CSV_MIME.xlsx,
  EXCEL_CSV_MIME.xls,
  EXCEL_CSV_MIME.csv,
  // Some browsers report CSV this way.
  "application/csv",
]);

const SIGNED_URL_SECONDS = 60 * 60;

/** HEIC/HEIF is allowed but not reliably previewable in browsers. */
const NON_PREVIEWABLE_IMAGE = new Set(["image/heic", "image/heif"]);

const DOCUMENT_MIME = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  EXCEL_CSV_MIME.xlsx,
  EXCEL_CSV_MIME.xls,
  EXCEL_CSV_MIME.csv,
  "application/csv",
]);

/**
 * Prefer browser MIME; fall back to extension for Excel/CSV when the
 * browser sends empty or application/octet-stream.
 */
export function resolveAttachmentMime(file: {
  type: string;
  name: string;
}): string {
  const typed = file.type?.trim() || "";
  if (typed && typed !== "application/octet-stream") {
    return typed;
  }
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "xlsx") return EXCEL_CSV_MIME.xlsx;
  if (ext === "xls") return EXCEL_CSV_MIME.xls;
  if (ext === "csv") return EXCEL_CSV_MIME.csv;
  return typed || "application/octet-stream";
}

export function attachmentKindFromMime(mime: string | null | undefined): AttachmentKind {
  if (!mime) return "other";
  if (NON_PREVIEWABLE_IMAGE.has(mime)) return "document";
  if (mime.startsWith("image/")) return "image";
  if (DOCUMENT_MIME.has(mime)) return "document";
  return "other";
}

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

/** Safe filename segment for Storage object keys. */
export function sanitizeFileName(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? "bestand";
  return base.replace(/[^\w.\-()+ ]+/g, "_").slice(0, 120) || "bestand";
}
