"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import {
  ATTACHMENTS_BUCKET,
  ALLOWED_ATTACHMENT_MIME,
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENT_LABEL,
  attachmentKindFromMime,
  resolveAttachmentMime,
  sanitizeFileName,
} from "@/data/attachments";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { one } from "@/lib/supabase/embed";
import type { TicketAttachment } from "@/lib/types";

type PrepareInput = {
  fileName: string;
  mimeType: string;
  byteSize: number;
};

type FinalizeInput = {
  storagePath: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
};

/**
 * Issue a short-lived signed upload URL so the browser can PUT the file
 * straight to Supabase Storage (avoids Vercel/Next ~4.5 MB request limits).
 */
export async function prepareAttachmentUploadAction(
  ticketId: string,
  input: PrepareInput,
): Promise<
  | { ok: true; storagePath: string; token: string; mimeType: string }
  | { ok: false; error: string }
> {
  if (!ticketId) {
    return { ok: false, error: "Ticket ontbreekt." };
  }
  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      error: "Supabase is niet geconfigureerd op deze omgeving.",
    };
  }

  if (!input.fileName || input.byteSize <= 0) {
    return { ok: false, error: "Kies een bestand om te uploaden." };
  }
  if (input.byteSize > MAX_ATTACHMENT_BYTES) {
    return {
      ok: false,
      error: `Bestand is te groot (max. ${MAX_ATTACHMENT_LABEL}).`,
    };
  }

  const mime = resolveAttachmentMime({
    type: input.mimeType,
    name: input.fileName,
  });
  if (!ALLOWED_ATTACHMENT_MIME.has(mime)) {
    return {
      ok: false,
      error:
        "Alleen afbeeldingen (JPG, PNG, GIF, WebP, HEIC), PDF, Word, Excel of CSV zijn toegestaan.",
    };
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { ok: false, error: "Je bent niet ingelogd." };
    }

    const safeName = sanitizeFileName(input.fileName);
    const storagePath = `${ticketId}/${randomUUID()}-${safeName}`;

    const { data, error } = await supabase.storage
      .from(ATTACHMENTS_BUCKET)
      .createSignedUploadUrl(storagePath);

    if (error || !data?.token) {
      return {
        ok: false,
        error: error?.message ?? "Upload-URL aanmaken mislukt.",
      };
    }

    return {
      ok: true,
      storagePath: data.path ?? storagePath,
      token: data.token,
      mimeType: mime,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Upload voorbereiden mislukt.",
    };
  }
}

/** Register the attachment row after a successful direct Storage upload. */
export async function finalizeAttachmentUploadAction(
  ticketId: string,
  input: FinalizeInput,
): Promise<{ ok: true; attachment: TicketAttachment } | { ok: false; error: string }> {
  if (!ticketId || !input.storagePath) {
    return { ok: false, error: "Ticket of bestandspad ontbreekt." };
  }
  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      error: "Supabase is niet geconfigureerd op deze omgeving.",
    };
  }

  // Path must stay under this ticket’s folder (prevents forging another path).
  if (!input.storagePath.startsWith(`${ticketId}/`)) {
    return { ok: false, error: "Ongeldig bestandspad." };
  }
  if (input.byteSize <= 0 || input.byteSize > MAX_ATTACHMENT_BYTES) {
    return {
      ok: false,
      error: `Bestand is te groot (max. ${MAX_ATTACHMENT_LABEL}).`,
    };
  }
  if (!ALLOWED_ATTACHMENT_MIME.has(input.mimeType)) {
    return {
      ok: false,
      error:
        "Alleen afbeeldingen (JPG, PNG, GIF, WebP, HEIC), PDF, Word, Excel of CSV zijn toegestaan.",
    };
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { ok: false, error: "Je bent niet ingelogd." };
    }

    const kind = attachmentKindFromMime(input.mimeType);
    const safeName = sanitizeFileName(input.fileName);
    const { data, error } = await supabase
      .from("ticket_attachments")
      .insert({
        ticket_id: ticketId,
        uploaded_by: user.id,
        storage_path: input.storagePath,
        file_name: safeName,
        mime_type: input.mimeType,
        byte_size: input.byteSize,
        kind,
      })
      .select(
        "id, ticket_id, uploaded_by, storage_path, file_name, mime_type, byte_size, kind, created_at, profiles!ticket_attachments_uploaded_by_fkey ( naam )",
      )
      .single();

    if (error || !data) {
      await supabase.storage.from(ATTACHMENTS_BUCKET).remove([input.storagePath]);
      return { ok: false, error: error?.message ?? "Opslaan mislukt." };
    }

    const { data: signed } = await supabase.storage
      .from(ATTACHMENTS_BUCKET)
      .createSignedUrl(input.storagePath, 60 * 60);

    const profile = one(data.profiles) as { naam: string } | null;
    const attachment: TicketAttachment = {
      id: data.id,
      ticketId: data.ticket_id,
      uploadedBy: data.uploaded_by,
      uploaderNaam: profile?.naam ?? "Gebruiker",
      storagePath: data.storage_path,
      fileName: data.file_name,
      mimeType: data.mime_type,
      byteSize: data.byte_size,
      kind: data.kind as TicketAttachment["kind"],
      createdAt: data.created_at.slice(0, 10),
      url: signed?.signedUrl,
    };

    revalidatePath(`/ticket/${ticketId}`);
    return { ok: true, attachment };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Opslaan mislukt.",
    };
  }
}

/**
 * @deprecated Prefer prepare + client Storage upload + finalize (Vercel body limits).
 * Kept for any callers that still post FormData through the server.
 */
export async function uploadAttachmentAction(
  ticketId: string,
  formData: FormData,
): Promise<{ ok: true; attachment: TicketAttachment } | { ok: false; error: string }> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Kies een bestand om te uploaden." };
  }

  const prepared = await prepareAttachmentUploadAction(ticketId, {
    fileName: file.name,
    mimeType: file.type,
    byteSize: file.size,
  });
  if (!prepared.ok) return prepared;

  try {
    const supabase = await createClient();
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
    });
  } catch (err) {
    try {
      const supabase = await createClient();
      await supabase.storage
        .from(ATTACHMENTS_BUCKET)
        .remove([prepared.storagePath]);
    } catch {
      // Best-effort cleanup of the orphaned Storage object.
    }
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Upload mislukt.",
    };
  }
}

export async function deleteAttachmentAction(
  attachmentId: string,
  ticketId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      error: "Supabase is niet geconfigureerd op deze omgeving.",
    };
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { ok: false, error: "Je bent niet ingelogd." };
    }

    const { data: row, error: fetchError } = await supabase
      .from("ticket_attachments")
      .select("id, storage_path, uploaded_by")
      .eq("id", attachmentId)
      .eq("ticket_id", ticketId)
      .maybeSingle();
    if (fetchError || !row) {
      return { ok: false, error: "Bijlage niet gevonden." };
    }

    const { error: deleteError } = await supabase
      .from("ticket_attachments")
      .delete()
      .eq("id", attachmentId);
    if (deleteError) {
      return { ok: false, error: deleteError.message };
    }

    await supabase.storage.from(ATTACHMENTS_BUCKET).remove([row.storage_path]);

    revalidatePath(`/ticket/${ticketId}`);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Verwijderen mislukt.",
    };
  }
}
