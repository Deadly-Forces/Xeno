import { z } from "zod";
import { audit } from "../../../../lib/audit";
import { campaignJobOptions, campaignQueue, deadLetterQueue } from "../../../../lib/queue";
import { isResponse, requireRole } from "../../../../lib/rbac";

export async function GET(): Promise<Response> {
  try {
    const actor = await requireRole("ADMIN");
    const jobs = await deadLetterQueue.getJobs(["waiting", "delayed", "failed", "completed"], 0, 99, true);
    const visible = [];
    for (const job of jobs) {
      const data = job.data.data;
      const campaign = data.kind === "deliver"
        ? await import("../../../../lib/db").then(({ db }) => db.campaignMessage.findUnique({ where: { id: data.campaignMessageId }, select: { campaign: { select: { organizationId: true } } } })).then((message) => message?.campaign)
        : await import("../../../../lib/db").then(({ db }) => db.campaign.findUnique({ where: { id: data.campaignId }, select: { organizationId: true } }));
      if (campaign?.organizationId === actor.organizationId) visible.push({ id: job.id, name: job.name, data: job.data, timestamp: job.timestamp, failedReason: job.failedReason });
    }
    return Response.json(visible);
  } catch (error) { return isResponse(error) ? error : Response.json({ error: "Unable to load dead letters" }, { status: 500 }); }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const actor = await requireRole("ADMIN");
    const input = z.object({ id: z.string().min(1) }).parse(await request.json());
    const deadLetter = await deadLetterQueue.getJob(input.id);
    if (!deadLetter) return Response.json({ error: "Dead-letter job not found" }, { status: 404 });
    const data = deadLetter.data.data;
    const owns = data.kind === "deliver"
      ? await import("../../../../lib/db").then(({ db }) => db.campaignMessage.count({ where: { id: data.campaignMessageId, campaign: { organizationId: actor.organizationId } } }))
      : await import("../../../../lib/db").then(({ db }) => db.campaign.count({ where: { id: data.campaignId, organizationId: actor.organizationId } }));
    if (!owns) return Response.json({ error: "Dead-letter job not found" }, { status: 404 });
    const jobId = data.kind === "deliver" ? data.campaignMessageId : `finalize-${data.campaignId}`;
    await campaignQueue.add(data.kind, data, { ...campaignJobOptions, jobId: `${jobId}-retry-${Date.now()}` });
    await audit(actor, "dead_letter.retry", "QueueJob", input.id, { originalJobId: deadLetter.data.originalJobId });
    await deadLetter.remove();
    return Response.json({ retried: true });
  } catch (error) { return isResponse(error) ? error : Response.json({ error: "Unable to retry dead letter" }, { status: 500 }); }
}
