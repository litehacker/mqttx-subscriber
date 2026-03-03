import { PrismaClient } from "@prisma/client";

declare global {
  namespace NodeJS {
    interface Global {}
  }
}

interface CustomNodeJsGlobal extends NodeJS.Global {
  prisma: PrismaClient;
}

declare const global: CustomNodeJsGlobal;

// Enforce a low connection limit in code to avoid "too many clients" (P2037)
function getDatasourceUrl(): string {
  const url = process.env.DATABASE_URL ?? "";
  if (!url) return url;
  if (/[?&]connection_limit=/.test(url)) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}connection_limit=3`;
}

const prisma =
  global.prisma ||
  new PrismaClient({
    datasources: { db: { url: getDatasourceUrl() } },
  });

// Reuse the same client in all environments to avoid "too many clients" (P2037)
global.prisma = prisma;

export default prisma;
