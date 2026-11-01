import { createHash, randomBytes } from "node:crypto";

/**
 * Deterministically stringify an object by recursively sorting its keys.
 * Ensures consistent cryptographic hash digests regardless of key order.
 */
export function canonicalJsonStringify(obj: unknown): string {
  if (obj === null || typeof obj !== "object") {
    return JSON.stringify(obj);
  }

  if (Array.isArray(obj)) {
    return `[${obj.map((item) => canonicalJsonStringify(item)).join(",")}]`;
  }

  const keys = Object.keys(obj as Record<string, unknown>).sort();
  const keyValues = keys.map(
    (key) => `${JSON.stringify(key)}:${canonicalJsonStringify((obj as Record<string, unknown>)[key])}`
  );

  return `{${keyValues.join(",")}}`;
}

/**
 * Computes a standardized SHA-256 hash digest of a payload (object, string, or buffer).
 */
export function computePayloadDigest(payload: unknown): string {
  const hash = createHash("sha256");
  if (typeof payload === "string") {
    hash.update(payload, "utf8");
  } else if (Buffer.isBuffer(payload)) {
    hash.update(payload);
  } else {
    hash.update(canonicalJsonStringify(payload), "utf8");
  }
  return hash.digest("hex");
}

/**
 * Verifies that a payload matches an expected SHA-256 digest.
 */
export function verifyPayloadDigest(payload: unknown, expectedHash: string): boolean {
  if (!expectedHash || typeof expectedHash !== "string") {
    return false;
  }
  const cleanExpected = expectedHash.startsWith("sha256:")
    ? expectedHash.slice(7)
    : expectedHash;
  const computed = computePayloadDigest(payload);
  return computed.toLowerCase() === cleanExpected.toLowerCase();
}

/**
 * Generates unique formatted identifiers for Bounty entities.
 */
export function generateEntityId(prefix: string): string {
  const rand = randomBytes(4).toString("hex");
  return `${prefix}_${Date.now().toString(36)}_${rand}`;
}

export function generateTaskId(): string {
  return generateEntityId("bnt");
}

export function generateRfpId(): string {
  return generateEntityId("rfp");
}

export function generateNodeId(): string {
  return generateEntityId("node");
}

export function generateNonce(): string {
  return randomBytes(16).toString("hex");
}

