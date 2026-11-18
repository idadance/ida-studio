/** @param {string} value */
export function escapeDriveQueryValue(value) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'");
}
