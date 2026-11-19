import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { AdminShell } from "@/components/features/admin/AdminShell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }
  if (!user.is_platform_admin) {
    redirect("/dashboard");
  }

  return <AdminShell email={user.email}>{children}</AdminShell>;
}
