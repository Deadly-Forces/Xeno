import type { Channel, Prisma } from "@prisma/client";
import { db } from "../core/db";
import { createHash } from "node:crypto";
import { createOperationalAlert } from "../observability/alerts";

export const FEATURE_NAMES = ["bias", "recency", "frequency", "monetary", "email", "sms", "whatsapp", "rcs"] as const;
export type FeatureVector = Record<(typeof FEATURE_NAMES)[number], number>;
export type TrainedArtifact = { coefficients: number[]; means: number[]; standardDeviations: number[]; calibration: Array<{ minimum: number; maximum: number; predicted: number; observed: number; count: number }>; metrics: { trainSize: number; validationSize: number; logLoss: number; brierScore: number; precisionAt20: number; baselineRate: number }; featureMeans: number[] };

type MlCustomer = { id: string; totalOrderValue: number | { toString(): string }; totalOrders: number; lastOrderAt: Date | null; channelPreference: Channel; conversionEvents: Array<{ createdAt: Date }> };

function clamp(value: number, min = 1e-6, max = 1 - 1e-6): number { return Math.min(max, Math.max(min, value)); }
function sigmoid(value: number): number { return 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, value)))); }

export function extractFeatures(customer: Pick<MlCustomer, "totalOrderValue" | "totalOrders" | "lastOrderAt" | "channelPreference">, now = new Date()): FeatureVector {
  const recencyDays = customer.lastOrderAt ? Math.max(0, (now.getTime() - customer.lastOrderAt.getTime()) / 86_400_000) : 730;
  return {
    bias: 1,
    recency: Math.log1p(recencyDays),
    frequency: Math.log1p(customer.totalOrders),
    monetary: Math.log1p(Number(customer.totalOrderValue)),
    email: customer.channelPreference === "EMAIL" ? 1 : 0,
    sms: customer.channelPreference === "SMS" ? 1 : 0,
    whatsapp: customer.channelPreference === "WHATSAPP" ? 1 : 0,
    rcs: customer.channelPreference === "RCS" ? 1 : 0
  };
}

function vector(features: FeatureVector): number[] { return FEATURE_NAMES.map((name) => features[name]); }
function dot(left: number[], right: number[]): number { return left.reduce((sum, value, index) => sum + value * (right[index] ?? 0), 0); }

export function predictArtifact(artifact: Pick<TrainedArtifact, "coefficients" | "means" | "standardDeviations">, features: FeatureVector): number {
  const values = vector(features).map((value, index) => index === 0 ? value : (value - (artifact.means[index] ?? 0)) / (artifact.standardDeviations[index] || 1));
  return sigmoid(dot(artifact.coefficients, values));
}

export function trainLogisticRegression(rows: Array<{ features: FeatureVector; label: boolean }>): TrainedArtifact {
  if (rows.length < 30) throw new Error("At least 30 labeled customers are required to train a model");
  const ordered = [...rows];
  const split = Math.max(20, Math.floor(ordered.length * 0.8));
  const train = ordered.slice(0, split);
  const validation = ordered.slice(split);
  const raw = train.map((row) => vector(row.features));
  const means = FEATURE_NAMES.map((_, index) => index === 0 ? 0 : raw.reduce((sum, item) => sum + (item[index] ?? 0), 0) / raw.length);
  const standardDeviations = FEATURE_NAMES.map((_, index) => index === 0 ? 1 : Math.sqrt(raw.reduce((sum, item) => sum + ((item[index] ?? 0) - (means[index] ?? 0)) ** 2, 0) / raw.length) || 1);
  const normalize = (features: FeatureVector) => vector(features).map((value, index) => index === 0 ? value : (value - (means[index] ?? 0)) / (standardDeviations[index] ?? 1));
  const coefficients = Array(FEATURE_NAMES.length).fill(0) as number[];
  const learningRate = 0.08;
  const regularization = 0.005;
  for (let iteration = 0; iteration < 1_200; iteration += 1) {
    const gradient = Array(coefficients.length).fill(0) as number[];
    for (const row of train) {
      const values = normalize(row.features);
      const error = sigmoid(dot(coefficients, values)) - Number(row.label);
      values.forEach((value, index) => { gradient[index] = (gradient[index] ?? 0) + error * value; });
    }
    coefficients.forEach((value, index) => { coefficients[index] = value - learningRate * (((gradient[index] ?? 0) / train.length) + (index === 0 ? 0 : regularization * value)); });
  }
  const predictions = validation.map((row) => ({ probability: predictArtifact({ coefficients, means, standardDeviations }, row.features), label: Number(row.label) }));
  const baselineRate = rows.filter((row) => row.label).length / rows.length;
  const logLoss = predictions.reduce((sum, item) => sum - (item.label * Math.log(clamp(item.probability)) + (1 - item.label) * Math.log(clamp(1 - item.probability))), 0) / Math.max(1, predictions.length);
  const brierScore = predictions.reduce((sum, item) => sum + (item.probability - item.label) ** 2, 0) / Math.max(1, predictions.length);
  const top = [...predictions].sort((a, b) => b.probability - a.probability).slice(0, Math.max(1, Math.round(predictions.length * 0.2)));
  const precisionAt20 = top.reduce((sum, item) => sum + item.label, 0) / top.length;
  const calibration = Array.from({ length: 5 }, (_, index) => {
    const minimum = index / 5; const maximum = (index + 1) / 5;
    const bin = predictions.filter((item) => item.probability >= minimum && (index === 4 ? item.probability <= maximum : item.probability < maximum));
    return { minimum, maximum, predicted: bin.length ? bin.reduce((sum, item) => sum + item.probability, 0) / bin.length : 0, observed: bin.length ? bin.reduce((sum, item) => sum + item.label, 0) / bin.length : 0, count: bin.length };
  });
  return { coefficients, means, standardDeviations, calibration, metrics: { trainSize: train.length, validationSize: validation.length, logLoss, brierScore, precisionAt20, baselineRate }, featureMeans: means };
}

export async function trainOrganizationModel(organizationId: string): Promise<{ id: string; version: string; metrics: TrainedArtifact["metrics"] }> {
  const customers = await db.customer.findMany({ where: { organizationId }, select: { id: true, totalOrderValue: true, totalOrders: true, lastOrderAt: true, channelPreference: true, conversionEvents: { select: { createdAt: true } } }, orderBy: { createdAt: "asc" } });
  const rows = customers.map((customer) => ({ customer, features: extractFeatures(customer), label: customer.conversionEvents.length > 0 }))
    .sort((left, right) => createHash("sha256").update(left.customer.id).digest().readUInt32BE(0) - createHash("sha256").update(right.customer.id).digest().readUInt32BE(0));
  const artifact = trainLogisticRegression(rows.map(({ features, label }) => ({ features, label })));
  const version = new Date().toISOString().replace(/[-:.TZ]/g, "");
  return db.$transaction(async (transaction) => {
    await transaction.modelVersion.updateMany({ where: { organizationId, name: "conversion-propensity", active: true }, data: { active: false } });
    const model = await transaction.modelVersion.create({ data: { organizationId, name: "conversion-propensity", version, algorithm: "logistic-regression-l2", coefficients: { values: artifact.coefficients, means: artifact.means, standardDeviations: artifact.standardDeviations }, calibration: artifact.calibration, metrics: { ...artifact.metrics, featureMeans: artifact.featureMeans }, active: true }, select: { id: true, version: true } });
    await transaction.featureSnapshot.createMany({ data: rows.map(({ customer, features, label }) => ({ organizationId, customerId: customer.id, modelVersionId: model.id, features: features as unknown as Prisma.InputJsonValue, label })) });
    return { ...model, metrics: artifact.metrics };
  });
}

export async function activeModel(organizationId: string): Promise<(TrainedArtifact & { id: string; version: string }) | null> {
  const model = await db.modelVersion.findFirst({ where: { organizationId, name: "conversion-propensity", active: true }, orderBy: { trainedAt: "desc" } });
  if (!model) return null;
  const coefficients = model.coefficients as { values: number[]; means: number[]; standardDeviations: number[] };
  const metrics = model.metrics as TrainedArtifact["metrics"] & { featureMeans?: number[] };
  return { id: model.id, version: model.version, coefficients: coefficients.values, means: coefficients.means, standardDeviations: coefficients.standardDeviations, calibration: model.calibration as TrainedArtifact["calibration"], metrics, featureMeans: metrics.featureMeans ?? coefficients.means };
}

export async function monitorDrift(organizationId: string): Promise<{ scoreDrift: number; alert: boolean }> {
  const model = await activeModel(organizationId);
  if (!model) throw new Error("No active model");
  const customers = await db.customer.findMany({ where: { organizationId }, select: { totalOrderValue: true, totalOrders: true, lastOrderAt: true, channelPreference: true } });
  const currentMeans = FEATURE_NAMES.map((_, index) => customers.reduce((sum, customer) => sum + vector(extractFeatures(customer))[index]!, 0) / Math.max(1, customers.length));
  const drift = currentMeans.map((value, index) => Math.abs(value - (model.featureMeans[index] ?? 0)) / (model.standardDeviations[index] || 1));
  const scoreDrift = drift.reduce((sum, value) => sum + value, 0) / drift.length;
  const alert = scoreDrift >= 0.5;
  await db.modelDriftReport.create({ data: { organizationId, modelVersionId: model.id, populationSize: customers.length, featureDrift: Object.fromEntries(FEATURE_NAMES.map((name, index) => [name, drift[index]])), scoreDrift, alert } });
  if (alert) await createOperationalAlert(organizationId, "warning", "model-drift", "Conversion model drift exceeded threshold", { modelVersionId: model.id, scoreDrift });
  return { scoreDrift, alert };
}
