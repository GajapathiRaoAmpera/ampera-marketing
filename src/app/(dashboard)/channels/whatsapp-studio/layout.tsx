"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { FeatureGate } from "@/components/features/entitlements/FeatureGate";

// These screens now live as tabs on the WhatsApp page. Only the flow builder,
// which needs the whole screen, still has a page of its own.
const MOVED: Record<string, string> = {
  "/channels/whatsapp-studio/campaigns": "/channels/whatsapp?tab=campaigns",
  "/channels/whatsapp-studio/forms": "/channels/whatsapp?tab=replies&section=flows",
  "/channels/whatsapp-studio/commerce": "/channels/whatsapp?tab=shop",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const target = MOVED[pathname];

  useEffect(() => {
    if (target) router.replace(target);
  }, [router, target]);

  if (target) return null;
  return (
    <FeatureGate featureKey="whatsapp_enabled" name="WhatsApp">
      {children}
    </FeatureGate>
  );
}
