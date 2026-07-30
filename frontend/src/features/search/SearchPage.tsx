import { useQuery } from "@tanstack/react-query";
import {
  BookOpen,
  Building2,
  ChevronRight,
  GraduationCap,
  Search as SearchIcon,
  Shapes,
  Users,
  X
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { searchGlobal } from "../../lib/api";
import type { SearchResultItem } from "../../lib/types";

const categoryIcons: Record<string, typeof GraduationCap> = {
  student: GraduationCap,
  faculty: Users,
  subject: BookOpen,
  course: BookOpen,
  department: Shapes,
  classroom: Building2
};

const categoryLabels: Record<string, string> = {
  student: "Student",
  faculty: "Faculty",
  subject: "Subject",
  course: "Course",
  department: "Department",
  classroom: "Classroom"
};

const categoryRoutes: Record<string, string> = {
  student: "/students",
  faculty: "/faculty",
  subject: "/subjects",
  course: "/courses",
  department: "/admin/departments",
  classroom: "/classrooms"
};

export function SearchPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const trimmedQuery = query.trim();

  const { data: searchData, isLoading, isError } = useQuery({
    queryKey: ["global-search", trimmedQuery],
    queryFn: () => searchGlobal(trimmedQuery, 50),
    enabled: trimmedQuery.length > 0,
    staleTime: 1000 * 30
  });

  const rawItems: SearchResultItem[] = searchData?.items ?? [];

  const filteredItems = activeCategory === "all"
    ? rawItems
    : rawItems.filter((item) => item.entity_type === activeCategory);

  function getEntityIcon(type: string) {
    const Icon = categoryIcons[type] ?? Shapes;
    return <Icon size={18} className="text-zinc-600" />;
  }

  function handleCardClick(type: string) {
    const route = categoryRoutes[type];
    if (route) {
      navigate(route);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <p className="text-xs uppercase tracking-wide text-zinc-400 font-semibold">Institutional Directory</p>
        <h1 className="mt-1 text-2xl font-bold text-zinc-900 tracking-tight">Global Search</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Search across enrolled students, faculty members, departments, courses, subjects, and classrooms.
        </p>
      </div>

      {/* Search Input Box */}
      <Card className="p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row items-center">
          <div className="flex flex-1 items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50/50 px-3.5 py-1.5 focus-within:border-zinc-900 focus-within:bg-white focus-within:ring-1 focus-within:ring-zinc-900 transition-all w-full">
            <SearchIcon size={18} className="text-zinc-400 shrink-0" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, employee ID, student number, subject code, department, or room..."
              className="border-0 px-0 focus:ring-0 bg-transparent text-zinc-900 text-sm placeholder:text-zinc-400 w-full"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="text-zinc-400 hover:text-zinc-700 transition-colors p-1"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-zinc-100">
          <button
            type="button"
            onClick={() => setActiveCategory("all")}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
              activeCategory === "all"
                ? "bg-zinc-900 text-white shadow-sm"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
            }`}
          >
            All Results ({rawItems.length})
          </button>
          {["student", "faculty", "subject", "course", "department", "classroom"].map((cat) => {
            const count = rawItems.filter((i) => i.entity_type === cat).length;
            if (rawItems.length > 0 && count === 0) return null;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  activeCategory === cat
                    ? "bg-zinc-900 text-white shadow-sm"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                }`}
              >
                {categoryLabels[cat]}s {count > 0 && `(${count})`}
              </button>
            );
          })}
        </div>
      </Card>

      {/* Loading & Status States */}
      {isLoading && (
        <div className="py-12 text-center text-sm font-medium text-zinc-500">
          Searching institutional databases...
        </div>
      )}

      {isError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-medium text-red-700">
          Search request failed. Please try again.
        </div>
      )}

      {/* Search Results Grid */}
      {!isLoading && trimmedQuery.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-zinc-500 font-medium px-1">
            <span>
              Showing {filteredItems.length} {filteredItems.length === 1 ? "result" : "results"} for &quot;{trimmedQuery}&quot;
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {filteredItems.map((item) => (
              <div
                key={`${item.entity_type}-${item.id}`}
                onClick={() => handleCardClick(item.entity_type)}
                className="group relative rounded-2xl border border-zinc-200/90 bg-white p-4 sm:p-5 shadow-sm hover:shadow-md hover:border-zinc-300 transition-all cursor-pointer flex items-start justify-between gap-4"
              >
                <div className="flex items-start gap-3.5 min-w-0">
                  <div className="p-2.5 rounded-xl bg-zinc-100 text-zinc-700 group-hover:bg-zinc-900 group-hover:text-white transition-colors shrink-0">
                    {getEntityIcon(item.entity_type)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-md">
                        {categoryLabels[item.entity_type] ?? item.entity_type}
                      </span>
                      {item.subtitle && (
                        <span className="text-xs font-mono text-zinc-500 font-medium truncate">
                          {item.subtitle}
                        </span>
                      )}
                    </div>
                    <h3 className="mt-1.5 text-base font-semibold text-zinc-900 group-hover:text-black truncate">
                      {item.title}
                    </h3>

                    {/* Metadata tags */}
                    {item.meta && (
                      <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-zinc-500">
                        {Object.entries(item.meta).map(([key, val]) => (
                          val ? (
                            <span key={key} className="inline-flex items-center gap-1 bg-zinc-50 border border-zinc-200/60 px-2 py-0.5 rounded-md text-[11px]">
                              <span className="capitalize text-zinc-400">{key}:</span>
                              <span className="font-medium text-zinc-700">{String(val)}</span>
                            </span>
                          ) : null
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="text-zinc-400 group-hover:text-zinc-900 transition-colors shrink-0 pt-1">
                  <ChevronRight size={18} />
                </div>
              </div>
            ))}
          </div>

          {filteredItems.length === 0 && (
            <Card className="py-10 text-center">
              <p className="text-sm font-medium text-zinc-600">No records found matching &quot;{trimmedQuery}&quot;</p>
              <p className="text-xs text-zinc-400 mt-1">Try searching by student number, employee ID, or subject name.</p>
            </Card>
          )}
        </div>
      )}

      {/* Empty State when Query is Blank */}
      {!isLoading && trimmedQuery.length === 0 && (
        <Card className="py-12 text-center border-dashed">
          <SearchIcon size={32} className="mx-auto text-zinc-300 mb-3" />
          <h3 className="text-base font-semibold text-zinc-800">Start typing to search</h3>
          <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto">
            Find student records, faculty profiles, subjects, courses, departments, or classrooms across the university system.
          </p>
        </Card>
      )}
    </div>
  );
}

