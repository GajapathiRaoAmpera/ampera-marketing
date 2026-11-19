import { FeatureGate } from "@/components/features/entitlements/FeatureGate";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <FeatureGate featureKey="messenger_enabled" name="Messenger">
      {children}
    </FeatureGate>
  );
}
