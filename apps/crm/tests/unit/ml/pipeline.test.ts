import { describe, expect, it } from "vitest";
import { extractFeatures, predictArtifact, trainLogisticRegression } from "../../../lib/ml/pipeline";

describe("ML pipeline", () => {
  it("trains a finite logistic model and returns calibrated probabilities", () => {
    const rows = Array.from({ length: 100 }, (_, index) => ({ features: extractFeatures({ totalOrderValue: index * 30, totalOrders: index % 20, lastOrderAt: new Date(Date.now() - (100 - index) * 86_400_000), channelPreference: "EMAIL" }), label: index >= 70 }));
    const artifact = trainLogisticRegression(rows);
    const low = predictArtifact(artifact, rows[5]!.features);
    const high = predictArtifact(artifact, rows[95]!.features);
    expect(high).toBeGreaterThan(low);
    expect(artifact.metrics.validationSize).toBe(20);
    expect(Number.isFinite(artifact.metrics.logLoss)).toBe(true);
  });
});
