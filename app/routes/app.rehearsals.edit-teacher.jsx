import { useSearchParams } from "react-router";

export default function EditTeacherPage() {
  const [searchParams] = useSearchParams();

  const id = searchParams.get("id");

  return (
    <s-page heading="Edit Teacher">
      <p>Teacher ID: {id}</p>
    </s-page>
  );
}