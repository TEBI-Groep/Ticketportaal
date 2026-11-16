import { redirect } from "next/navigation";

/** Root entry: UI shell has no real auth yet — send visitors to login. */
export default function HomePage() {
  redirect("/login");
}
