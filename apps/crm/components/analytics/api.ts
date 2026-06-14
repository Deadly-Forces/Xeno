export type AnalyticsData = {
  channels: Array<{ channel: string; messages: number; delivered: number; opened: number; clicked: number }>;
  segments: Array<{ name: string; customers: number; messages: number; clicked: number; clickRate: number }>;
  attribution: Array<{ id: string; name: string; channel: string; conversions: number; revenue: number }>;
  providerCost: number;
  churnDistribution: Array<{ label: string; customers: number }>;
  timeSeries: Array<{ date: string; conversions: number; revenue: number; cost: number }>;
  experiments: Array<{ id: string; hypothesis: string; status: string; recipients: number; conversions: number; target: number; progress: number }>;
};

export type DecisioningData = {
  modelVersion: string;
  audienceSize: number;
  expectedRevenue: number;
  highChurnRisk: number;
  benchmark: {
    selected: number;
    ai: { precision: number; revenue: number };
    random: { precision: number; revenue: number };
    uplift: { precisionPercent: number; revenuePercent: number };
  };
  recommendations: Array<{
    customerId: string;
    name: string;
    decisionScore: number;
    expectedRevenue: number;
    churnRisk: number;
    recommendedChannel: string;
    recommendedSendHour: number;
    reasons: string[];
  }>;
};

async function getJson<T>(url: string, message: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(message);
  return response.json() as Promise<T>;
}

export const getAnalytics = (): Promise<AnalyticsData> =>
  getJson("/api/analytics", "Unable to load analytics");

export const getDecisioning = (): Promise<DecisioningData> =>
  getJson("/api/decisioning", "Unable to load decision model");
