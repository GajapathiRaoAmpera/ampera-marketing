import { FeatureGate } from "@/components/features/entitlements/FeatureGate";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <FeatureGate featureKey="telegram_enabled" name="Telegram">
      {children}
    </FeatureGate>
  );
}
