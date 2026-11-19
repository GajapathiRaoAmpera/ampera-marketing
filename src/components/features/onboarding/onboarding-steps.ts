// Maps the backend's onboarding.missing_fields to the wizard's UI steps.
// The backend derives missing_fields fresh on every read (see FRONTEND_INTEGRATION.md §4).
// this file's job is only to *group* those fields into a sensible flow, not to
// recompute completeness. Extend the `fields` array here if the backend adds fields;
// unknown/extra fields on the Business object don't break anything, they just won't
// gate progress until added to a step below.

export interface OnboardingStepDef {
  id: string;
  title: string;
  description: string;
  fields: string[];
  requiredFields: string[];
}

export const ONBOARDING_STEPS: OnboardingStepDef[] = [
  {
    id: "basics",
    title: "Business basics",
    description: "Tell the AI what your business does and where it operates.",
    fields: ["description", "location"],
    requiredFields: ["description", "location"],
  },
  {
    id: "contact",
    title: "Website & availability",
    description: "Add your website and the hours customers can reach you.",
    fields: ["website", "working_hours"],
    requiredFields: ["working_hours"],
  },
  {
    id: "offerings",
    title: "Products & pricing",
    description: "Explain what you offer and how much it costs.",
    fields: ["products_services", "pricing"],
    requiredFields: ["products_services"],
  },
  {
    id: "guidance",
    title: "Customer guidance",
    description: "Give the AI your policies, useful details, and common answers.",
    fields: ["policies", "additional_info", "faqs"],
    requiredFields: [],
  },
];

export function stepCompletion(step: OnboardingStepDef, missingFields: string[]): { done: number; total: number } {
  const missingInStep = step.requiredFields.filter((f) => missingFields.includes(f));
  return { done: step.requiredFields.length - missingInStep.length, total: step.requiredFields.length };
}
