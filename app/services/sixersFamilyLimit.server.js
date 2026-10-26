import { getPerformanceRoster } from "./performanceRoster.server.js";

function splitEmails(value) {
  return [...new Set(
    String(value ?? "")
      .toLowerCase()
      .split(/[;,\s]+/)
      .map((email) => email.trim())
      .filter(Boolean),
  )];
}

export async function getSixersFamilyEmails(
  rosterSheetGid,
  customerEmail,
) {
  const roster = await getPerformanceRoster(rosterSheetGid);

  if (!roster.dancers.length) {
    throw new Error(
      "The Sixers family roster is empty or unavailable.",
    );
  }

  const buyerEmail = String(customerEmail ?? "")
    .trim()
    .toLowerCase();

  const groups = [];

  for (const dancer of roster.dancers) {
    const emails = splitEmails(dancer.email);

    if (!emails.length) {
      continue;
    }

    const matchingGroups = groups.filter((group) =>
      emails.some((email) => group.has(email)),
    );

    const combined = new Set(emails);

    for (const group of matchingGroups) {
      for (const email of group) {
        combined.add(email);
      }
    }

    for (const group of matchingGroups) {
      groups.splice(groups.indexOf(group), 1);
    }

    groups.push(combined);
  }

  // Merge any groups connected through a shared parent email.
  let changed = true;

  while (changed) {
    changed = false;

    for (let i = 0; i < groups.length; i += 1) {
      for (let j = i + 1; j < groups.length; j += 1) {
        if ([...groups[i]].some((email) => groups[j].has(email))) {
          for (const email of groups[j]) {
            groups[i].add(email);
          }

          groups.splice(j, 1);
          changed = true;
          break;
        }
      }

      if (changed) break;
    }
  }

  const family = groups.find((group) =>
    group.has(buyerEmail),
  );

  if (!family) {
    throw new Error(
      "We couldn't match this email to an HHC family. Please contact the studio.",
    );
  }

  return [...family];
}