export type DashboardPoint = {
  date: string;
  sent: number;
  opened: number;
  clicked: number;
  conversions: number;
  revenue: number;
  cost: number;
};

export type DashboardData = {
  filters: { days: number; channel: string };
  metrics: {
    customers: number;
    active: number;
    conversions: number;
    openRate: number;
    revenue: number;
    cost: number;
    trends: Record<string, number>;
  };
  funnel: {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    purchased: number;
  };
  series: DashboardPoint[];
  campaigns: Array<{
    id: string;
    name: string;
    channel: string;
    status: string;
    createdAt: string;
    segment: { name: string };
  }>;
  topCampaign: null | {
    id: string;
    name: string;
    revenue: number;
    conversions: number;
  };
  topSegment: string | null;
  needsAttention: Array<{
    id: string;
    severity: string;
    title: string;
    source: string;
    createdAt: string;
  }>;
  activity: Array<{
    id: string;
    action: string;
    entityType: string;
    actorEmail: string;
    createdAt: string;
  }>;
};

export async function getDashboard(range: string, channel: string): Promise<DashboardData> {
  const params = new URLSearchParams({ range, channel });
  const response = await fetch(`/api/dashboard?${params}`);
  if (!response.ok) throw new Error("Unable to load dashboard");
  return response.json() as Promise<DashboardData>;
}
