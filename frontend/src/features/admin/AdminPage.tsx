import { Building2, GraduationCap, School, Settings, UserPlus } from "lucide-react";
import { Link } from "react-router-dom";
import { Card } from "../../components/ui/Card";

const modules = [
  { title: "Departments", description: "Manage department codes, names, and academic ownership.", icon: School, to: "/admin/departments" },
  { title: "Faculty", description: "Register faculty profiles and assign departments.", icon: UserPlus, to: "/faculty" },
  { title: "Students", description: "Register students and maintain enrollment records.", icon: GraduationCap, to: "/students" },
  { title: "Classrooms", description: "Manage rooms, capacity, building, and camera references.", icon: Building2, to: "/classrooms" },
  { title: "System Settings", description: "Configure recognition confidence thresholds and reports.", icon: Settings, to: "/admin" }
];

export function AdminPage() {
  return (
    <div className="space-y-5">
      <div><h2 className="text-2xl font-bold text-slate-950">Admin Module</h2><p className="text-sm text-slate-500">Institution-wide setup and governance for SmartAttend AI.</p></div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {modules.map((module) => {
          const Icon = module.icon;
          return <Link key={module.title} to={module.to}><Card className="h-full transition hover:border-brand-200 hover:shadow-lg"><Icon className="text-brand-600" size={24} /><h3 className="mt-4 text-lg font-semibold">{module.title}</h3><p className="mt-2 text-sm leading-6 text-slate-500">{module.description}</p></Card></Link>;
        })}
      </div>
    </div>
  );
}
