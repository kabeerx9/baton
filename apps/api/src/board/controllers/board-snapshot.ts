import db from "../../database";

export type BoardReadTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * One read-only REPEATABLE READ snapshot, so the done window's selection,
 * its count and the payload read the same committed state.
 */
export function boardSnapshot<T>(read: (tx: BoardReadTx) => Promise<T>) {
  return db.transaction(read, {
    isolationLevel: "repeatable read",
    accessMode: "read only",
  });
}
