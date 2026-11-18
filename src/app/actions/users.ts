"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/data/auth";
import {
  createUserAccount,
  updateUserAccount,
  type CreateUserInput,
  type UpdateUserInput,
} from "@/data/users";
import type { User } from "@/lib/types";

export async function createUserAction(
  input: CreateUserInput,
): Promise<{ ok: true; user: User } | { ok: false; error: string }> {
  const me = await getCurrentUser();
  if (me.rol !== "uitvoerder") {
    return { ok: false, error: "Alleen uitvoerders mogen accounts aanmaken." };
  }

  const result = await createUserAccount(input);
  if (result.ok) {
    revalidatePath("/gebruikers");
  }
  return result;
}

export async function updateUserAction(
  input: UpdateUserInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const me = await getCurrentUser();
  if (me.rol !== "uitvoerder") {
    return { ok: false, error: "Alleen uitvoerders mogen accounts bewerken." };
  }

  if (input.id === me.id) {
    if (!input.actief) {
      return { ok: false, error: "Je kunt je eigen account niet deactiveren." };
    }
    if (input.rol !== "uitvoerder") {
      return { ok: false, error: "Je kunt je eigen rol niet wijzigen." };
    }
  }

  const result = await updateUserAccount(input);
  if (result.ok) {
    revalidatePath("/gebruikers");
  }
  return result;
}
