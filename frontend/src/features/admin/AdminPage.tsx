import { BarChart3, Building2, GraduationCap, Settings, Shapes, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { Card } from "../../components/ui/Card";

const modules = [
  { title: "Dashboard", description: "Operational overview and live attendance metrics.", icon: BarChart3, to: "/" },
  { title: "Departments", description: "Manage branches and link them to a course.", icon: Shapes, to: "/admin/departments" },
  { title: "Faculty", description: "Register faculty and manage assignments.", icon: Users, to: "/faculty" },
  { title: "Students", description: "Register students and enroll face images.", icon: GraduationCap, to: "/students" },
  { title: "Courses", description: "Maintain programs, names, and abbreviations.", icon: Shapes, to: "/courses" },
  { title: "Classrooms", description: "Manage classroom capacity and camera details.", icon: Building2, to: "/classrooms" },
  { title: "Subjects", description: "Track teaching subjects and structure.", icon: Shapes, to: "/subjects" },
  { title: "Assignments", description: "Bind faculty to subjects and sections.", icon: Users, to: "/subject-assignments" },
  { title: "Settings", description: "Institution settings and recognition thresholds.", icon: Settings, to: "/admin" }
];

export function AdminPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-400">Administration</p>
        <h2 className="mt-1 text-2xl font-semibold text-slate-950">System Setup</h2>
        <p className="mt-1 text-sm text-slate-500">Core operational modules for institution-wide management.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {modules.map((module) => {
          const Icon = module.icon;
          return (
            <Link key={module.title} to={module.to}>
              <Card className="h-full transition hover:border-brand-200 hover:shadow-lg">
                <Icon className="text-brand-700" size={24} />
                <h3 className="mt-4 text-lg font-semibold text-slate-950">{module.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">{module.description}</p>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
