import { db } from "../lib/core/db";
import { monitorDrift, trainOrganizationModel } from "../lib/ml/pipeline";

const organizationId = process.argv[2] ?? "org_xeno_default";
async function main(): Promise<void> {
  const model = await trainOrganizationModel(organizationId);
  const drift = await monitorDrift(organizationId);
  console.log(JSON.stringify({ model, drift }, null, 2));
}
main().finally(async () => db.$disconnect());
