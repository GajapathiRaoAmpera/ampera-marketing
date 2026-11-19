import { FeatureGate } from "@/components/features/entitlements/FeatureGate";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <FeatureGate featureKey="sms_enabled" name="SMS">
      {children}
    </FeatureGate>
  );
}
