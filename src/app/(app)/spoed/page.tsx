import { redirect } from "next/navigation";

/**
 * Spoed list is retired as a standalone page — urgent tickets live on Overzicht.
 * Keep the route so old bookmarks / ?van=/spoed links land somewhere useful.
 */
export default function SpoedPage() {
  redirect("/overzicht");
}
