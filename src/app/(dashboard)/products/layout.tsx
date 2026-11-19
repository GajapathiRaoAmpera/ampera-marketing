import { FeatureGate } from "@/components/features/entitlements/FeatureGate";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <FeatureGate featureKey="product_catalog_enabled" name="Products">
      {children}
    </FeatureGate>
  );
}
