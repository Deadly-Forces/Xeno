export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startCampaignWorker } = await import("./lib/core/queue");
    startCampaignWorker();
  }
}
