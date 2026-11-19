import { BusinessProvider } from "@/context/BusinessContext";
import { EntitlementsProvider } from "@/context/EntitlementsContext";
import { DashboardShell } from "@/components/layout/DashboardShell";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <BusinessProvider>
      <EntitlementsProvider>
        <DashboardShell>{children}</DashboardShell>
      </EntitlementsProvider>
    </BusinessProvider>
  );
}
