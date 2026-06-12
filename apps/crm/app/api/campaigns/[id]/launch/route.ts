import { CampaignLaunchError, launchCampaign } from "../../../../../lib/campaigns/launch";
import { audit } from "../../../../../lib/audit";
import { isResponse, requireRole } from "../../../../../lib/rbac";

export async function POST(request: Request, context: { params: { id: string } }): Promise<Response> {
  try {
    const actor = await requireRole("MARKETER");
    const result = await launchCampaign(context.params.id, actor.organizationId);
    await audit(actor, "campaign.launch", "Campaign", context.params.id, { enqueued: result.enqueued }, request.headers.get("x-forwarded-for"));
    return Response.json(result, { status: 202 });
  }
  catch (error) {
    if (isResponse(error)) return error;
    if (error instanceof CampaignLaunchError) return Response.json({ error: error.message }, error.status === 429 ? { status: error.status, headers: { "retry-after": "10" } } : { status: error.status });
    throw error;
  }
}
