import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const shows = await prisma.show.findMany();

  console.log(`Found ${shows.length} shows`);

  for (const show of shows) {
    await prisma.show.update({
      where: {
        id: show.id,
      },
      data: {
        fwCheckTicketVariantId: show.shopifyCheckTicketVariantId,
        fwCreditTicketVariantId: show.shopifyCreditTicketVariantId,

        fwCheckVideoVariantId: show.shopifyCheckVideoVariantId,
        fwCreditVideoVariantId: show.shopifyCreditVideoVariantId,
      },
    });

    console.log(`Updated ${show.name}`);
  }

  console.log("✅ Finished copying FW variant IDs");
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });