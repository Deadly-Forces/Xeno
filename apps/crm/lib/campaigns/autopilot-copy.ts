type CampaignCopy = {
  control: string;
  treatment: string;
  hypothesis: string;
  preservedOffer: string | null;
};

const money = String.raw`\$\s?\d[\d,]*(?:\.\d{1,2})?`;

const offerPatterns = [
  new RegExp(String.raw`\b(?:can\s+)?(win\s+back\s+${money})`, "i"),
  new RegExp(String.raw`\b(?:can\s+)?((?:get|receive|earn|claim|save)\s+${money})`, "i"),
  new RegExp(String.raw`\b(${money}\s+(?:off|credit|cash\s?back|reward|voucher))`, "i"),
  /\b(\d+(?:\.\d+)?%\s+off(?:\s+(?:all|selected)\s+[a-z][a-z -]*)?)/i,
];

function clean(value: string): string {
  return value.replace(/\s+/g, " ").replace(/[.,;:!?]+$/, "").trim();
}

export function extractCustomerOffer(intent: string): string | null {
  for (const pattern of offerPatterns) {
    const match = intent.match(pattern);
    if (match?.[1]) return clean(match[1]);
  }
  return null;
}

function offerSentence(offer: string): string {
  if (/^(?:win back|get|receive|earn|claim|save)\b/i.test(offer)) {
    return `You can ${offer}.`;
  }
  if (/^\d+(?:\.\d+)?%\s+off\b/i.test(offer)) {
    return `Get ${offer}.`;
  }
  return `Claim your ${offer}.`;
}

export function buildAutopilotCopy(intent: string, channel: string): CampaignCopy {
  const offer = extractCustomerOffer(intent);
  const incentive = offer ? `${offerSentence(offer)} ` : "";
  const compact = ["SMS", "WHATSAPP", "RCS"].includes(channel);

  return {
    control: compact
      ? `Hi {{name}}, we miss you. ${incentive}Return to see new picks inspired by {{lastProduct}}.`
      : `Hi {{name}}, it has been a while. ${incentive}Come back to discover what is new for you, including picks inspired by {{lastProduct}}.`,
    treatment: compact
      ? `Hi {{name}}, ${incentive}Your next favorite may already be waiting. Revisit picks inspired by {{lastProduct}} today.`
      : `Hi {{name}}, ${incentive}Your next favorite may already be waiting. Explore recommendations inspired by {{lastProduct}} today.`,
    hypothesis: offer
      ? `Leading with the explicit ${offer} incentive will increase conversion versus a standard win-back reminder.`
      : "A curiosity-led personalized message will increase conversion versus a standard win-back reminder.",
    preservedOffer: offer,
  };
}
