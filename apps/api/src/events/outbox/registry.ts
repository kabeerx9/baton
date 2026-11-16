import { activityOutboxConsumer } from "../../activity/outbox-consumer";
import type { LocalConsumer } from "./consumer";
import type { ConsumerName } from "./routes";

export const OUTBOX_CONSUMERS: Record<ConsumerName, LocalConsumer> = {
  activity: activityOutboxConsumer,
};

export function findConsumer(name: string): LocalConsumer | null {
  return Object.hasOwn(OUTBOX_CONSUMERS, name)
    ? OUTBOX_CONSUMERS[name as ConsumerName]
    : null;
}
