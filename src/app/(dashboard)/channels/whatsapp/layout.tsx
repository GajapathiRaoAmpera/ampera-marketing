import { FeatureGate } from "@/components/features/entitlements/FeatureGate";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <FeatureGate featureKey="whatsapp_enabled" name="WhatsApp">
      {children}
    </FeatureGate>
  );
}
