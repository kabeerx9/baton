import { eq } from "drizzle-orm";
import db from "../database";
import { slackUserLinkTable } from "../database/schema";
import {
  apiRouter,
  type BaseVariables,
  createRoute,
  errorResponse,
  jsonResponse,
  z,
} from "../openapi";
import { slackConfig } from "./config";
import { testMessage } from "./messages";
import { sendDm } from "./send-dm";
import "./subscribe";

const statusSchema = z
  .object({
    enabled: z.boolean().openapi({
      description: "False when the server has no SLACK_BOT_TOKEN.",
    }),
    slackUserId: z.string().nullable(),
    source: z.enum(["email", "manual"]).nullable().openapi({
      description:
        "How the link was made. Null when no lookup has run for the caller yet.",
    }),
  })
  .openapi("SlackDmStatus");

const getStatusRoute = createRoute({
  method: "get",
  operationId: "getSlackDmStatus",
  path: "/me",
  tags: ["Slack"],
  summary: "Get my Slack link",
  description:
    "Whether Slack messages are on, and which Slack user the caller is linked to.",
  responses: { 200: jsonResponse("The caller's Slack link", statusSchema) },
});

const setLinkRoute = createRoute({
  method: "put",
  operationId: "setSlackDmLink",
  path: "/me",
  tags: ["Slack"],
  summary: "Set my Slack user id by hand",
  description:
    "For people whose tracker email differs from their Slack email. Send null to go back to the email lookup.",
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: z.object({
            slackUserId: z
              .string()
              .regex(/^[UW][A-Z0-9]{6,}$/, "Not a Slack member ID")
              .nullable(),
          }),
        },
      },
    },
  },
  responses: {
    200: jsonResponse("The caller's Slack link", statusSchema),
    400: errorResponse("Not a Slack member ID"),
  },
});

const sendTestRoute = createRoute({
  method: "post",
  operationId: "sendSlackDmTest",
  path: "/me/test",
  tags: ["Slack"],
  summary: "Send myself a test message",
  description:
    "Sends one direct message to the caller and reports what happened.",
  responses: {
    200: jsonResponse(
      "What happened",
      z
        .object({
          outcome: z.enum([
            "sent",
            "slack_not_configured",
            "no_slack_user",
            "failed",
          ]),
        })
        .openapi("SlackDmTestResult"),
    ),
  },
});

async function statusFor(userId: string) {
  const [link] = await db
    .select()
    .from(slackUserLinkTable)
    .where(eq(slackUserLinkTable.userId, userId))
    .limit(1);
  return {
    enabled: slackConfig() !== null,
    slackUserId: link?.slackUserId ?? null,
    source:
      link?.source === "manual"
        ? ("manual" as const)
        : link?.checkedAt
          ? ("email" as const)
          : null,
  };
}

const slackDm = apiRouter<BaseVariables>()
  .openapi(getStatusRoute, async (c) =>
    c.json(await statusFor(c.get("userId")), 200),
  )
  .openapi(setLinkRoute, async (c) => {
    const userId = c.get("userId");
    const { slackUserId } = c.req.valid("json");
    // Null clears the manual link and the saved lookup, so the next message
    // looks the person up by email again.
    const values = slackUserId
      ? { slackUserId, source: "manual", checkedAt: new Date() }
      : { slackUserId: null, source: "email", checkedAt: null };
    await db
      .insert(slackUserLinkTable)
      .values({ userId, ...values })
      .onConflictDoUpdate({ target: slackUserLinkTable.userId, set: values });
    return c.json(await statusFor(userId), 200);
  })
  .openapi(sendTestRoute, async (c) =>
    c.json({ outcome: await sendDm(c.get("userId"), testMessage()) }, 200),
  );

export default slackDm;
