import { useMutation } from "@tanstack/react-query";
import { Search as SearchIcon } from "lucide-react";
import { useState } from "react";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { searchGlobal } from "../../lib/api";
import type { SearchResult } from "../../lib/types";

export function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const runSearch = useMutation({
    mutationFn: async () => searchGlobal(query, 20),
    onSuccess: (data) => {
      setResults(data);
      setError(null);
    },
    onError: () => {
      setResults([]);
      setError("Search failed");
    }
  });

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-400">Search</p>
        <h2 className="mt-1 text-2xl font-semibold text-slate-950">Global Search</h2>
        <p className="mt-1 text-sm text-slate-500">Find students, faculty, departments, courses, classrooms, and subjects.</p>
      </div>

      <Card>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex flex-1 items-center gap-3 rounded-md border border-slate-200 bg-white px-3">
            <SearchIcon size={18} className="text-slate-400" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name, abbreviation, or number" className="border-0 px-0 focus:ring-0" />
          </div>
          <button
            type="button"
            onClick={() => runSearch.mutate()}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
          >
            Search
          </button>
        </div>
        {error && <p className="mt-4 text-sm text-rose-700">{error}</p>}
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        {results.map((item) => (
          <Card key={`${item.entity_type}-${item.id}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">{item.entity_type}</p>
                <h3 className="mt-1 text-lg font-semibold text-slate-950">{item.title}</h3>
                {item.subtitle && <p className="mt-1 text-sm text-slate-500">{item.subtitle}</p>}
              </div>
              {item.status && <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">{item.status}</span>}
            </div>
          </Card>
        ))}
        {results.length === 0 && (
          <Card>
            <p className="text-sm text-slate-500">Run a search to see matching records.</p>
          </Card>
        )}
      </div>
    </div>
  );
}
