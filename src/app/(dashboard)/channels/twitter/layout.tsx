import { FeatureGate } from "@/components/features/entitlements/FeatureGate";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <FeatureGate featureKey="twitter_enabled" name="X (Twitter)">
      {children}
    </FeatureGate>
  );
}
