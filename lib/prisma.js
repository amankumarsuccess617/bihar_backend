import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis;

// PostgreSQL pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Adapter
const adapter = new PrismaPg(pool);

// Prisma instance
const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    adapter,
  });

// Prevent multiple instances in dev
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;