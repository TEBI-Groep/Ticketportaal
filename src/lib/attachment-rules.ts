import type { AttachmentKind } from "@/lib/types";

export const ATTACHMENTS_BUCKET = "ticket-attachments";
/** Soft cap shown in UI; uploads go browser → Supabase (not through Vercel body). */
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const MAX_ATTACHMENT_LABEL = "10 MB";

/** Excel / CSV MIME types accepted as ticket bijlagen. */
export const EXCEL_CSV_MIME = {
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  /** Macro-enabled workbook (.xlsm). */
  xlsm: "application/vnd.ms-excel.sheet.macroEnabled.12",
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
  EXCEL_CSV_MIME.xlsm,
  EXCEL_CSV_MIME.xls,
  EXCEL_CSV_MIME.csv,
  // Some browsers report CSV this way.
  "application/csv",
]);

/** HEIC/HEIF is allowed but not reliably previewable in browsers. */
const NON_PREVIEWABLE_IMAGE = new Set(["image/heic", "image/heif"]);

const DOCUMENT_MIME = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  EXCEL_CSV_MIME.xlsx,
  EXCEL_CSV_MIME.xlsm,
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
  if (ext === "xlsm") return EXCEL_CSV_MIME.xlsm;
  if (ext === "xls") return EXCEL_CSV_MIME.xls;
  if (ext === "csv") return EXCEL_CSV_MIME.csv;
  return typed || "application/octet-stream";
}

/** Client-side check so the UI can fail fast before the server action. */
export function validateAttachmentFile(file: {
  type: string;
  name: string;
  size: number;
}): string | null {
  if (file.size <= 0) return "Kies een bestand om te uploaden.";
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return `Bestand is te groot (max. ${MAX_ATTACHMENT_LABEL}).`;
  }
  const mime = resolveAttachmentMime(file);
  if (!ALLOWED_ATTACHMENT_MIME.has(mime)) {
    return "Alleen afbeeldingen (JPG, PNG, GIF, WebP, HEIC), PDF, Word, Excel of CSV zijn toegestaan.";
  }
  return null;
}

export function attachmentKindFromMime(
  mime: string | null | undefined,
): AttachmentKind {
  if (!mime) return "other";
  if (NON_PREVIEWABLE_IMAGE.has(mime)) return "document";
  if (mime.startsWith("image/")) return "image";
  if (DOCUMENT_MIME.has(mime)) return "document";
  return "other";
}

/** Safe filename segment for Storage object keys. */
export function sanitizeFileName(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? "bestand";
  return base.replace(/[^\w.\-()+ ]+/g, "_").slice(0, 120) || "bestand";
}
