import bcrypt from "bcrypt";
import { env } from "../../config/env";

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, env.BCRYPT_ROUNDS);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

let dummyHash: Promise<string> | undefined;

/** Compare against a throwaway hash so unknown emails take as long as wrong passwords. */
export async function burnPasswordCheck(password: string): Promise<void> {
  dummyHash ??= bcrypt.hash("timing-equaliser-not-a-password", env.BCRYPT_ROUNDS);
  await bcrypt.compare(password, await dummyHash);
}
