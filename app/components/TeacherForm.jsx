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