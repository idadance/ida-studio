export default function TeacherForm({
  teacher = {},
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
        name="active"
        checked={teacher.active ?? true}
      >
        Active Teacher
      </s-checkbox>

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