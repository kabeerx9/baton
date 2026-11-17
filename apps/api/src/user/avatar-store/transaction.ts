import type db from "../../database";

export type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
