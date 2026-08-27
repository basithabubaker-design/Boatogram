import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const DEFAULT_CANCELLATION_TIERS = [
  { minDaysBefore: 7, refundPercent: 90 },
  { minDaysBefore: 3, refundPercent: 75 },
  { minDaysBefore: 1, refundPercent: 50 },
  { minDaysBefore: 0, refundPercent: 0 },
];

async function main() {
  const policy = await prisma.cancellationPolicy.upsert({
    where: { id: "default-policy" },
    create: {
      id: "default-policy",
      name: "Platform default",
      isDefault: true,
      tiers: { createMany: { data: DEFAULT_CANCELLATION_TIERS } },
    },
    update: {},
  });
  console.log(`Cancellation policy ready: ${policy.name}`);

  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@boatogram.example";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe123!";
  const passwordHash = await bcrypt.hash(adminPassword, 12);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    create: {
      email: adminEmail,
      name: "Boatogram Admin",
      passwordHash,
      role: "ADMIN",
    },
    update: {},
  });
  console.log(`Admin user ready: ${admin.email} (set SEED_ADMIN_PASSWORD to change the seeded password)`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
