import { MongoMemoryReplSet } from "mongodb-memory-server";
import type { TestProject } from "vitest/node";

declare module "vitest" {
  export interface ProvidedContext {
    mongoUri: string;
  }
}

let replSet: MongoMemoryReplSet | undefined;

/**
 * Starts one in-memory replica set for the whole run (a replica set so that
 * transactions work). Set MONGOMS_SYSTEM_BINARY to use a local mongod instead
 * of downloading one.
 */
export async function setup(project: TestProject) {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  project.provide("mongoUri", replSet.getUri());
}

export async function teardown() {
  await replSet?.stop();
}
