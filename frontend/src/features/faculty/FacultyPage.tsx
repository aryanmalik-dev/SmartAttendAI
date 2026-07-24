import { ResourcePage } from "../admin/ResourcePage";

export function FacultyPage() {
  return <ResourcePage title="Faculty" path="/faculty" fields={["employee_id", "department_id", "designation", "phone"]} />;
}
