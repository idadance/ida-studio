import prisma from "../db.server";

export async function getSetting(
  key: string,
) {
  const setting =
    await prisma.setting.findUnique({
      where: { key },
    });

  return setting?.value ?? null;
}

export async function setSetting(
  key: string,
  value: string,
) {
  return prisma.setting.upsert({
    where: { key },

    update: {
      value,
    },

    create: {
      key,
      value,
    },
  });
}