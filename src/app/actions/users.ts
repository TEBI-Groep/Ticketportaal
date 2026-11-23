"use server";

import { revalidatePath } from "next/cache";
import { requireUitvoerderAction } from "@/data/auth";
import {
  createUserAccount,
  deleteUserAccount,
  setUserPassword,
  updateUserAccount,
  type CreateUserInput,
  type DeleteUserResult,
  type UpdateUserInput,
} from "@/data/users";
import type { User } from "@/lib/types";

export async function createUserAction(
  input: CreateUserInput,
): Promise<{ ok: true; user: User } | { ok: false; error: string }> {
  const gate = await requireUitvoerderAction();
  if (!gate.ok) {
    return { ok: false, error: gate.error };
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
  const gate = await requireUitvoerderAction();
  if (!gate.ok) {
    return { ok: false, error: gate.error };
  }

  const me = gate.user;
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

/** IT sets a new Auth password for a user (no mail reset yet). */
export async function setUserPasswordAction(
  userId: string,
  password: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const gate = await requireUitvoerderAction();
  if (!gate.ok) {
    return { ok: false, error: gate.error };
  }

  const result = await setUserPassword(userId, password);
  if (result.ok) {
    revalidatePath("/gebruikers");
  }
  return result;
}

/** IT permanently deletes a user after confirmation in the UI. */
export async function deleteUserAction(
  userId: string,
): Promise<DeleteUserResult> {
  const gate = await requireUitvoerderAction();
  if (!gate.ok) {
    return { ok: false, error: gate.error };
  }

  const result = await deleteUserAccount(userId, gate.user.id);
  if (result.ok) {
    revalidatePath("/gebruikers");
  }
  return result;
}
