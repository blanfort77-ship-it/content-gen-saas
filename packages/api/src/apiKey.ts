import { randomBytes } from "node:crypto";

export function generateApiKey(): string {
  return `cg_${randomBytes(24).toString("hex")}`;
}
