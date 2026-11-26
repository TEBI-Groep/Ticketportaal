import { redirect } from "next/navigation";

/** Legacy URL — Ranglijst was renamed to Netsuite. */
export default function RanglijstRedirectPage() {
  redirect("/netsuite");
}
