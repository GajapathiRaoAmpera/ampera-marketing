import { FeatureGate } from "@/components/features/entitlements/FeatureGate";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <FeatureGate featureKey="discord_enabled" name="Discord">
      {children}
    </FeatureGate>
  );
}
