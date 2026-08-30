import { google } from "googleapis";
import prisma from "../db.server";
import { Readable } from "node:stream";

import type {
  Performance,
  Reservation,
} from "@prisma/client";

async function getDrive() {
  const setting = await prisma.appSetting.findUnique({
    where: {
      key: "google_refresh_token",
    },
  });

  if (!setting) {
    throw new Error(
      "Google Drive has not been connected.",
    );
  }

  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  );

  auth.setCredentials({
    refresh_token: setting.value,
  });

  return google.drive({
    version: "v3",
    auth,
  });
}

const ROOT_FOLDER_ID =
  process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID!;

export async function createFolder(
  name: string,
  parentId: string,
) {
  const drive = await getDrive();

  const result = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    },
    fields: "id,name",
  });

  console.log(`📁 Created folder: ${name}`);

  return result.data;
}

export async function ensurePerformanceFolders(
  performance: Performance,
) {
  if (
    performance.driveFolderId &&
    performance.driveCustomersFolderId &&
    performance.driveVideosFolderId
  ) {
    return {
      performanceFolderId: performance.driveFolderId,
      customersFolderId:
        performance.driveCustomersFolderId,
      videosFolderId:
        performance.driveVideosFolderId,
    };
  }

  console.log(
    `📁 Creating folders for ${performance.name}`,
  );

  const performanceFolder =
    await createFolder(
      performance.name,
      ROOT_FOLDER_ID,
    );

  const customersFolder =
    await createFolder(
      "Customers",
      performanceFolder.id!,
    );

  const videosFolder =
    await createFolder(
      "Videos",
      performanceFolder.id!,
    );

  await prisma.performance.update({
    where: {
      id: performance.id,
    },
    data: {
      driveFolderId: performanceFolder.id!,
      driveCustomersFolderId:
        customersFolder.id!,
      driveVideosFolderId:
        videosFolder.id!,
    },
  });

  console.log(
    "✅ Performance folders ready",
  );

  return {
    performanceFolderId:
      performanceFolder.id!,
    customersFolderId:
      customersFolder.id!,
    videosFolderId:
      videosFolder.id!,
  };
}

export async function ensureCustomerFolder(
  reservation: Reservation,
  customersFolderId: string,
) {
  const drive = await getDrive();

  // Reservation already knows its folder
  if (reservation.driveFolderId) {
    return reservation.driveFolderId;
  }

  // Look for an existing customer folder
  const existing = await drive.files.list({
    q: `'${customersFolderId}' in parents
        and mimeType='application/vnd.google-apps.folder'
        and name='${reservation.customerName}'
        and trashed=false`,
    fields: "files(id,name)",
  });

  if ((existing.data.files?.length ?? 0) > 0) {
    const folderId = existing.data.files![0].id!;

    await drive.permissions.create({
  fileId: folderId,
  requestBody: {
    role: "reader",
    type: "anyone",
  },
});

    console.log(
      `📁 Reusing customer folder for ${reservation.customerName}`,
    );

    await prisma.reservation.update({
  where: {
    id: reservation.id,
  },
  data: {
    driveFolderId: folderId,
    driveFolderLink:
      `https://drive.google.com/drive/folders/${folderId}`,
  },
});

    return folderId;
  }

  console.log(
    `📁 Creating customer folder for ${reservation.customerName}`,
  );

  const customerFolder =
  await createFolder(
    reservation.customerName,
    customersFolderId,
  );

await drive.permissions.create({
  fileId: customerFolder.id!,
  requestBody: {
    role: "reader",
    type: "anyone",
  },
});

  await prisma.reservation.update({
  where: {
    id: reservation.id,
  },
  data: {
    driveFolderId: customerFolder.id!,
    driveFolderLink:
      `https://drive.google.com/drive/folders/${customerFolder.id!}`,
  },
});

  console.log(
    "✅ Customer folder ready",
  );

  return customerFolder.id!;
}

export async function uploadTicketPDF(
  pdf: Buffer,
  customerFolderId: string,
  fileName: string,
) {
  const drive = await getDrive();

  console.log(
    `📄 Uploading ${fileName}...`,
  );

  const result = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [customerFolderId],
    },
    media: {
      mimeType: "application/pdf",
      body: Readable.from(pdf),
    },
    fields: "id,name",
  });

  console.log(
    `✅ Uploaded PDF: ${result.data.name}`,
  );

  return result.data;
}

export async function deleteCustomerTicketPDFs(
  customerFolderId: string,
) {
  const drive = await getDrive();

  console.log(
    "🗑️ Looking for existing ticket PDFs in customer folder...",
  );

  // Customer folders contain ticket PDFs
  // plus non-PDF items such as the
  // Performance Videos shortcut.
  //
  // When an order is edited, remove every
  // ticket PDF and rebuild the customer's
  // active tickets from the database.
  const existing =
    await drive.files.list({
      q: `'${customerFolderId}' in parents
          and mimeType='application/pdf'
          and trashed=false`,
      fields: "files(id,name)",
    });

  const pdfs =
    existing.data.files ?? [];

  for (const file of pdfs) {
    if (!file.id) {
      continue;
    }

    await drive.files.delete({
      fileId: file.id,
    });

    console.log(
      `🗑️ Deleted old ticket PDF: ${file.name}`,
    );
  }

  console.log(
    `✅ Removed ${pdfs.length} existing ticket PDF(s)`,
  );

  return {
    deleted: pdfs.length,
  };
}

export async function customerFolderHasTicketPDFs(
  customerFolderId: string,
) {
  const drive = await getDrive();

  const existing = await drive.files.list({
    q: `'${customerFolderId}' in parents
        and mimeType='application/pdf'
        and trashed=false`,
    fields: "files(id,name)",
  });

  const pdfs = existing.data.files ?? [];

  console.log(
    `📄 Found ${pdfs.length} existing PDF(s) in customer folder`,
  );

  return pdfs.length > 0;
}

export async function customerFolderHasVideoShortcut(
  customerFolderId: string,
) {
  const drive = await getDrive();

  const existing =
    await drive.files.list({
      q: `'${customerFolderId}' in parents
          and name='🎥 Performance Videos'
          and trashed=false`,
      fields: "files(id,name)",
    });

  const shortcuts =
    existing.data.files ?? [];

  console.log(
    `🎥 Found ${shortcuts.length} video shortcut(s) in customer folder`,
  );

  return shortcuts.length > 0;
}

export async function createVideoShortcut(
  customerFolderId: string,
  videosFolderId: string,
) {
  const drive = await getDrive();

  // Check if the shortcut already exists
  const existing = await drive.files.list({
    q: `'${customerFolderId}' in parents
        and name='🎥 Performance Videos'
        and trashed=false`,
    fields: "files(id,name)",
  });

  if ((existing.data.files?.length ?? 0) > 0) {
    console.log(
      "⏭️ Video shortcut already exists",
    );
    return existing.data.files![0];
  }

  console.log(
    "🔗 Creating video shortcut...",
  );

  const result = await drive.files.create({
    requestBody: {
      name: "🎥 Performance Videos",
      mimeType:
        "application/vnd.google-apps.shortcut",
      parents: [customerFolderId],
      shortcutDetails: {
        targetId: videosFolderId,
      },
    },
    fields: "id,name",
  });

  console.log(
    "✅ Video shortcut created",
  );

  return result.data;
}

export async function prepareCustomerFolder(
  performance: Performance,
  reservation: Reservation,
  digitalVideo: boolean,
) {
  const folders =
    await ensurePerformanceFolders(
      performance,
    );

  const customerFolderId =
    await ensureCustomerFolder(
      reservation,
      folders.customersFolderId,
    );

  if (digitalVideo) {
    await createVideoShortcut(
      customerFolderId,
      folders.videosFolderId,
    );
  }

  return customerFolderId;
}