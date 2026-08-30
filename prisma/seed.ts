import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.studio.upsert({
    where: { name: "Fort Washington" },
    update: {
      code: "FW",
    },
    create: {
      name: "Fort Washington",
      code: "FW",
    },
  });

  await prisma.studio.upsert({
    where: { name: "Plymouth Meeting" },
    update: {
      code: "PM",
    },
    create: {
      name: "Plymouth Meeting",
      code: "PM",
    },
  });

  console.log("Studios seeded.");
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });