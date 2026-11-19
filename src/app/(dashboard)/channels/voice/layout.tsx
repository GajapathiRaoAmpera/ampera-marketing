import { FeatureGate } from "@/components/features/entitlements/FeatureGate";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <FeatureGate featureKey="voice_calling_enabled" name="Voice calling">
      {children}
    </FeatureGate>
  );
}
