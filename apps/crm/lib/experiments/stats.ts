export type VariantMetric = { kind: "CONTROL" | "TREATMENT"; recipients: number; conversions: number; revenue: number };

function erf(value: number): number {
  const sign = value < 0 ? -1 : 1;
  const x = Math.abs(value);
  const t = 1 / (1 + 0.3275911 * x);
  const approximation = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return sign * approximation;
}

export function experimentResult(control: VariantMetric, treatment: VariantMetric): {
  controlRate: number;
  treatmentRate: number;
  upliftPercent: number;
  zScore: number;
  confidence: number;
  significant: boolean;
  winner: "CONTROL" | "TREATMENT" | "INCONCLUSIVE";
} {
  const controlRate = control.recipients ? control.conversions / control.recipients : 0;
  const treatmentRate = treatment.recipients ? treatment.conversions / treatment.recipients : 0;
  const pooled = (control.conversions + treatment.conversions) / Math.max(1, control.recipients + treatment.recipients);
  const error = Math.sqrt(pooled * (1 - pooled) * ((control.recipients ? 1 / control.recipients : 0) + (treatment.recipients ? 1 / treatment.recipients : 0)));
  const zScore = error > 0 ? (treatmentRate - controlRate) / error : 0;
  const pValue = 2 * (1 - (0.5 * (1 + erf(Math.abs(zScore) / Math.sqrt(2)))));
  const confidence = Math.max(0, Math.min(1, 1 - pValue));
  const upliftPercent = controlRate > 0 ? ((treatmentRate - controlRate) / controlRate) * 100 : treatmentRate > 0 ? 100 : 0;
  const significant = confidence >= 0.95;
  return { controlRate, treatmentRate, upliftPercent, zScore, confidence, significant, winner: significant ? treatmentRate > controlRate ? "TREATMENT" : "CONTROL" : "INCONCLUSIVE" };
}
