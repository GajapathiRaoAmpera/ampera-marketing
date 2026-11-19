import { FeatureGate } from "@/components/features/entitlements/FeatureGate";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <FeatureGate featureKey="instagram_enabled" name="Instagram">
      {children}
    </FeatureGate>
  );
}
