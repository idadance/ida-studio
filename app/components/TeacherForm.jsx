export default function TeacherForm({
  teacher = {},
  genres = [],
  submitLabel = "Save Teacher",
}) {
  return (
    <>
      <s-text-field
        label="First Name"
        name="firstName"
        value={teacher.firstName ?? ""}
        required
      />

      <br />

      <s-text-field
        label="Last Name"
        name="lastName"
        value={teacher.lastName ?? ""}
      />

      <br />

      <s-number-field
        label="Maximum Solo/Duets"
        name="maxSoloDuets"
        value={String(
          teacher.maxSoloDuets ?? 10,
        )}
        min="0"
      />

      <br />

      <h3>Genres Taught</h3>

<div
  style={{
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: "8px",
    marginBottom: "16px",
  }}
>
  {genres.map((genre) => (
    <s-checkbox
  key={genre.id}
  label={genre.name}
  name="genres"
  value={genre.id}
  checked={teacher.genres?.some(
    (g) => g.id === genre.id,
  )}
/>
  ))}
</div>

<br />

      <s-text-field
  label="Availability Sheet URL"
  name="availabilitySheetUrl"
  value={
    teacher.availabilitySheetUrl ?? ""
  }
  helpText="Paste the Google Sheets URL to this teacher's Rehearsal Availability tab."
/>

<br />

      <s-checkbox
  label="Active Teacher"
  name="active"
  checked={teacher.active ?? true}
/>

      <br />

      <s-text-area
        label="Notes"
        name="notes"
        value={teacher.notes ?? ""}
      />

      <br />

      <button type="submit">
        {submitLabel}
      </button>
    </>
  );
}