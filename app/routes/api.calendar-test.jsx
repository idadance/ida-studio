export async function loader() {
  const email =
    process.env.ICLOUD_CALENDAR_EMAIL;

  const password =
    process.env.ICLOUD_CALENDAR_PASSWORD;

  return Response.json({
    emailConfigured: Boolean(email),
    passwordConfigured: Boolean(password),
  });
}