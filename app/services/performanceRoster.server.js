const PERFORMANCE_ROSTER_SHEET_ID =
  "1uDSFzLHM4QkF1ooi0vzC9y8-WQ-Ihv_XeR8MNVJVtCw";


function clean(value) {
  return String(
    value ?? "",
  ).trim();
}


function normalizeEmail(value) {
  return clean(
    value,
  ).toLowerCase();
}


function normalizeStudio(value) {
  const studio =
    clean(
      value,
    ).toUpperCase();

  if (
    studio === "FW" ||
    studio ===
      "FORT WASHINGTON"
  ) {
    return "FW";
  }

  if (
    studio === "PM" ||
    studio ===
      "PLYMOUTH MEETING"
  ) {
    return "PM";
  }

  return null;
}


function parseCsvLine(line) {
  const values = [];

  let current = "";
  let insideQuotes = false;

  for (
    let i = 0;
    i < line.length;
    i += 1
  ) {
    const character =
      line[i];

    if (character === '"') {
      if (
        insideQuotes &&
        line[i + 1] === '"'
      ) {
        current += '"';
        i += 1;
      } else {
        insideQuotes =
          !insideQuotes;
      }

      continue;
    }

    if (
      character === "," &&
      !insideQuotes
    ) {
      values.push(
        current,
      );

      current = "";

      continue;
    }

    current += character;
  }

  values.push(
    current,
  );

  return values;
}


// ======================================
// PERFORMANCE ROSTER
//
// One master Google Sheet is used for
// all performance rosters.
//
// Each Performance stores the GID of
// the tab containing its roster.
// ======================================

export async function getPerformanceRoster(
  rosterSheetGid,
) {
  if (
    rosterSheetGid ===
      null ||
    rosterSheetGid ===
      undefined ||
    String(
      rosterSheetGid,
    ).trim() === ""
  ) {
    throw new Error(
      "This performance does not have a roster tab assigned.",
    );
  }

  const gid =
    encodeURIComponent(
      String(
        rosterSheetGid,
      ).trim(),
    );

  const rosterCsvUrl =
    `https://docs.google.com/spreadsheets/d/${PERFORMANCE_ROSTER_SHEET_ID}/export?format=csv&gid=${gid}`;

  const response =
    await fetch(
      rosterCsvUrl,
    );

  if (!response.ok) {
    throw new Error(
      `Could not load performance roster: ${response.status}`,
    );
  }

  const csv =
    await response.text();

  const lines =
    csv
      .split(/\r?\n/)
      .filter(
        (line) =>
          line.trim() !== "",
      );

  if (
    lines.length <= 1
  ) {
    return {
      dancers: [],
      families: [],
    };
  }


  // ======================================
  // PARSE DANCERS
  //
  // Heading row:
  // First, Last, Grade, Studio,
  // Email, Phone
  // ======================================

  const dataRows =
    lines.slice(1);

  const dancers =
    dataRows
      .map(
        (
          line,
          index,
        ) => {
          const [
            first,
            last,
            grade,
            studio,
            email,
            phone,
          ] =
            parseCsvLine(
              line,
            );

          return {
            rowNumber:
              index + 2,

            firstName:
              clean(
                first,
              ),

            lastName:
              clean(
                last,
              ),

            grade:
              clean(
                grade,
              ),

            studio:
              normalizeStudio(
                studio,
              ),

            studioRaw:
              clean(
                studio,
              ),

            email:
              normalizeEmail(
                email,
              ),

            phone:
              clean(
                phone,
              ),
          };
        },
      )
      .filter(
        (dancer) =>
          dancer.firstName ||
          dancer.lastName ||
          dancer.email,
      );


  // ======================================
  // GROUP DANCERS INTO FAMILIES
  //
  // Shared parent email = one family.
  // ======================================

  const familyMap =
    new Map();

  for (
    const dancer of
    dancers
  ) {
    const familyKey =
      dancer.email ||
      `missing-email:${dancer.rowNumber}`;

    const existing =
      familyMap.get(
        familyKey,
      );

    if (existing) {
      existing.dancers.push(
        dancer,
      );

      if (
        !existing.studio &&
        dancer.studio
      ) {
        existing.studio =
          dancer.studio;
      }

      continue;
    }

    familyMap.set(
      familyKey,
      {
        key:
          familyKey,

        email:
          dancer.email,

        studio:
          dancer.studio,

        dancers: [
          dancer,
        ],
      },
    );
  }


  const families =
    Array.from(
      familyMap.values(),
    ).map(
      (family) => ({
        ...family,

        dancerNames:
          family.dancers.map(
            (dancer) =>
              `${dancer.firstName} ${dancer.lastName}`.trim(),
          ),

        familyName:
          family.dancers.length ===
          1
            ? family
                .dancers[0]
                .lastName
            : family.dancers
                .map(
                  (dancer) =>
                    dancer.lastName,
                )
                .filter(
                  Boolean,
                )
                .filter(
                  (
                    name,
                    index,
                    names,
                  ) =>
                    names.indexOf(
                      name,
                    ) ===
                    index,
                )
                .join(
                  " / ",
                ),
      }),
    );


  return {
    dancers,
    families,
  };
}