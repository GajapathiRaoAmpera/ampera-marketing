import { redirect } from "next/navigation";

// This now lives as a tab on the Instagram page.
export default function Page() {
  redirect("/channels/instagram?tab=automations");
}
