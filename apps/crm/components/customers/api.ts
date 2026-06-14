export type Customer = {
  id: string;
  externalId: string;
  name: string;
  email: string | null;
  phone: string | null;
  city: string;
  ageGroup: string;
  gender: string;
  tags: string[];
  totalOrderValue: string;
  totalOrders: number;
  lastOrderAt: string | null;
  channelPreference: string;
  consentStatus: string;
  suppressedAt: string | null;
  suppressionReason: string | null;
  maxMessagesPerWeek: number;
};

export type CustomerSegment = { id: string; name: string };
export type CustomerPageData = { customers: Customer[]; nextCursor: string | null };

export type CustomerQuery = {
  query: string;
  segment: string;
  sort: string;
  direction: string;
  cursor: string | null;
};

export async function getCustomerSegments(): Promise<CustomerSegment[]> {
  const response = await fetch("/api/segments");
  if (!response.ok) throw new Error("Unable to load segments");
  return response.json() as Promise<CustomerSegment[]>;
}

export async function getCustomers(input: CustomerQuery): Promise<CustomerPageData> {
  const params = new URLSearchParams({
    q: input.query,
    limit: "25",
    sort: input.sort,
    direction: input.direction,
  });
  if (input.segment) params.set("segment", input.segment);
  if (input.cursor) params.set("cursor", input.cursor);
  const response = await fetch(`/api/customers?${params}`);
  if (!response.ok) throw new Error("Unable to load customers");
  return response.json() as Promise<CustomerPageData>;
}
