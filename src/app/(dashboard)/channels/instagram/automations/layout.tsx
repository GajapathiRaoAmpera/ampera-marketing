import { FeatureGate } from "@/components/features/entitlements/FeatureGate";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <FeatureGate featureKey="instagram_automations_enabled" name="Instagram automations">
      {children}
    </FeatureGate>
  );
}
