import { redirect } from "next/navigation";

export default function Page() {
  redirect("/channels/messenger?tab=contacts");
}
