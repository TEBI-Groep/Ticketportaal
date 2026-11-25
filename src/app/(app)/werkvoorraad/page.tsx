import { redirect } from "next/navigation";

/**
 * Werkvoorraad is retired as a standalone page — open tickets live on Overzicht.
 * Keep the route so old bookmarks / ?van=/werkvoorraad links land somewhere useful.
 */
export default function WerkvoorraadPage() {
  redirect("/overzicht");
}
