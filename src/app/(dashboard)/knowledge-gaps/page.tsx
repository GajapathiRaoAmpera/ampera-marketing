import { redirect } from "next/navigation";

export default function Page() {
  redirect("/agent-config?tab=gaps");
}
