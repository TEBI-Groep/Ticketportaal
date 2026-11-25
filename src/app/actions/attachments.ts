"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import {
  ATTACHMENTS_BUCKET,
  ALLOWED_ATTACHMENT_MIME,
  MAX_ATTACHMENT_BYTES,
  attachmentKindFromMime,
  resolveAttachmentMime,
  sanitizeFileName,
} from "@/data/attachments";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { one } from "@/lib/supabase/embed";
import type { TicketAttachment } from "@/lib/types";

export async function uploadAttachmentAction(
  ticketId: string,
  formData: FormData,
): Promise<{ ok: true; attachment: TicketAttachment } | { ok: false; error: string }> {
  if (!ticketId) {
    return { ok: false, error: "Ticket ontbreekt." };
  }
  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      error: "Supabase is niet geconfigureerd op deze omgeving.",
    };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Kies een bestand om te uploaden." };
  }
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return { ok: false, error: "Bestand is te groot (max. 5 MB)." };
  }
  const mime = resolveAttachmentMime(file);
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

    const safeName = sanitizeFileName(file.name);
    const storagePath = `${ticketId}/${randomUUID()}-${safeName}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabase.storage
      .from(ATTACHMENTS_BUCKET)
      .upload(storagePath, buffer, {
        contentType: mime,
        upsert: false,
      });
    if (uploadError) {
      return { ok: false, error: uploadError.message };
    }

    const kind = attachmentKindFromMime(mime);
    const { data, error } = await supabase
      .from("ticket_attachments")
      .insert({
        ticket_id: ticketId,
        uploaded_by: user.id,
        storage_path: storagePath,
        file_name: safeName,
        mime_type: mime,
        byte_size: file.size,
        kind,
      })
      .select(
        "id, ticket_id, uploaded_by, storage_path, file_name, mime_type, byte_size, kind, created_at, profiles!ticket_attachments_uploaded_by_fkey ( naam )",
      )
      .single();

    if (error || !data) {
      await supabase.storage.from(ATTACHMENTS_BUCKET).remove([storagePath]);
      return { ok: false, error: error?.message ?? "Opslaan mislukt." };
    }

    const { data: signed } = await supabase.storage
      .from(ATTACHMENTS_BUCKET)
      .createSignedUrl(storagePath, 60 * 60);

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
