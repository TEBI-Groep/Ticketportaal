"use client";

import {
  finalizeAttachmentUploadAction,
  prepareAttachmentUploadAction,
} from "@/app/actions/attachments";
import { ATTACHMENTS_BUCKET, validateAttachmentFile } from "@/lib/attachment-rules";
import { createClient } from "@/lib/supabase/client";
import type { TicketAttachment } from "@/lib/types";

export type UploadTicketAttachmentOptions = {
  /** Link the file to an Updates & vragen comment after upload. */
  commentId?: string | null;
};

/**
 * Upload a ticket bijlage via signed Storage URL (browser → Supabase),
 * so files up to MAX_ATTACHMENT_BYTES are not blocked by Vercel/Next body limits.
 */
export async function uploadTicketAttachment(
  ticketId: string,
  file: File,
  options: UploadTicketAttachmentOptions = {},
): Promise<{ ok: true; attachment: TicketAttachment } | { ok: false; error: string }> {
  const clientError = validateAttachmentFile(file);
  if (clientError) {
    return { ok: false, error: clientError };
  }

  const prepared = await prepareAttachmentUploadAction(ticketId, {
    fileName: file.name,
    mimeType: file.type,
    byteSize: file.size,
  });
  if (!prepared.ok) {
    return prepared;
  }

  try {
    const supabase = createClient();
    const { error: uploadError } = await supabase.storage
      .from(ATTACHMENTS_BUCKET)
      .uploadToSignedUrl(prepared.storagePath, prepared.token, file, {
        contentType: prepared.mimeType,
        upsert: false,
      });

    if (uploadError) {
      return { ok: false, error: uploadError.message };
    }

    return finalizeAttachmentUploadAction(ticketId, {
      storagePath: prepared.storagePath,
      fileName: file.name,
      mimeType: prepared.mimeType,
      byteSize: file.size,
      commentId: options.commentId ?? null,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Upload mislukt. Probeer opnieuw.";
    // Next sometimes surfaces oversized server-action posts this way.
    if (/unexpected response/i.test(message)) {
      return {
        ok: false,
        error:
          "Upload mislukt door een serverlimiet. Vernieuw de pagina en probeer opnieuw.",
      };
    }
    return { ok: false, error: message };
  }
}
