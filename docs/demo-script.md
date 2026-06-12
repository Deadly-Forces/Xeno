# Two-Minute Internship Demo

## 0:00-0:20 - Frame the Problem

Open the dashboard. Explain that most CRMs stop at storing customers and sending campaigns. Xeno decides who is worth contacting, measures whether the decision worked, and survives delivery failures.

## 0:20-0:45 - Natural-Language Audience

Open Segments and ask the AI assistant:

`Customers in Austin who spent over $500 and have not ordered in 60 days.`

Show the validated rule output and customer preview. Mention that model-generated fields are never executed directly; they pass through the shared Zod DSL.

## 0:45-1:15 - Decisioning and Experiment

Open Analytics. Show:

- Ranked customers with score, expected revenue, churn risk, channel, send hour, and reason.
- AI top-k versus seeded random top-k.
- The warning that offline uplift is not causal.

Create a campaign. Keep the randomized experiment enabled and show the control and AI treatment messages. Explain stable 50/50 assignment.

## 1:15-1:40 - Live Delivery and Measurement

Launch the campaign and open its detail page. Point out authenticated WebSocket updates, expected revenue, provider cost/ROI, churn risk, and the experiment panel. Explain that the system only declares a winner at 95% confidence.

## 1:40-2:00 - Reliability and Security

Sign in as an administrator and open Operations. Show the audit trail and dead-letter queue. Close with the controls: role-based access, signed callbacks, rate limits, idempotent sends, retries, and Docker Compose.

## Reviewer Questions

- Why no trained ML model? The synthetic dataset is too small for credible generalization; the transparent baseline is testable and honest.
- Why SSE instead of WebSockets? Delivery is one-way, and SSE provides automatic reconnect with lower operational complexity.
- How is uplift validated? Offline ranking is labeled non-causal; online message uplift comes from randomized assignment and a significance test.
