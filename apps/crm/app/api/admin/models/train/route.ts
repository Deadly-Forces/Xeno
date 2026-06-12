import { audit } from "../../../../../lib/audit";
import { monitorDrift, trainOrganizationModel } from "../../../../../lib/ml/pipeline";
import { isResponse, requireRole } from "../../../../../lib/rbac";

export async function POST(): Promise<Response> {
  try {
    const actor = await requireRole("ADMIN");
    const model = await trainOrganizationModel(actor.organizationId);
    await audit(actor, "model.train", "ModelVersion", model.id, { version: model.version, metrics: model.metrics });
    return Response.json(model, { status: 201 });
  } catch (error) { return isResponse(error) ? error : Response.json({ error: error instanceof Error ? error.message : "Training failed" }, { status: 400 }); }
}

export async function GET(): Promise<Response> {
  try {
    const actor = await requireRole("ADMIN");
    return Response.json(await monitorDrift(actor.organizationId));
  } catch (error) { return isResponse(error) ? error : Response.json({ error: error instanceof Error ? error.message : "Drift check failed" }, { status: 400 }); }
}
