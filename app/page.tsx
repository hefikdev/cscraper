"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc/client";

export default function Home() {
  const [wojewodztwo, setWojewodztwo] = useState("");
  const [city, setCity] = useState("");
  const [campType, setCampType] = useState("Półkolonie");
  const [category, setCategory] = useState("");
  const [method, setMethod] = useState("ALL");
  const [queryNotes, setQueryNotes] = useState("");

  const jobsQuery = trpc.searchJobs.list.useQuery();
  const leadsQuery = trpc.leads.list.useQuery();
  const createJob = trpc.searchJobs.create.useMutation({
    onSuccess: () => jobsQuery.refetch(),
  });

  const categorizeAll = trpc.leads.categorizeAll.useMutation({
    onSuccess: () => leadsQuery.refetch(),
  });

  const [selectedLeadJson, setSelectedLeadJson] = useState<string | null>(null);

  const dorkPreview = useMemo(() => {
    if (!city && !category) return "";
    const phrases = [
      `\"${campType}\"`,
      city ? `\"${city}\"` : null,
      category ? `\"${category}\"` : null,
      "\"telefon\"",
    ].filter(Boolean);

    if (method === "FACEBOOK") return `site:facebook.com ${phrases.join(" ")}`;
    if (method === "GOOGLE") return `${phrases.join(" ")}`;
    return `ALL: Google -> ${phrases.join(" ")}  |  Facebook -> site:facebook.com ${phrases.join(" ")}`;
  }, [campType, city, category, method]);

  const handleCreate = () => {
    createJob.mutate({
      wojewodztwo: wojewodztwo.trim(),
      city: city.trim(),
      campType: campType.trim(),
      category: category.trim(),
      method: method,
      queryNotes: queryNotes.trim() || null,
    });
  };

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-12 text-zinc-950 dark:bg-black dark:text-zinc-50">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Shadow Market: Google Index Scraper
          </h1>
          <p className="max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
            Konfiguruj parametry dorkingu, zapisuj joby i kontroluj pipeline
            pozyskiwania leadów do kwarantanny.
          </p>
        </header>

        <div className="grid gap-6 md:grid-cols-[1.2fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Nowy job wyszukiwania</CardTitle>
              <CardDescription>
                Parametry zapisują się w bazie i mogą być użyte przez scraper.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="woj">Województwo</Label>
                  <Input
                    id="woj"
                    value={wojewodztwo}
                    onChange={(event) => setWojewodztwo(event.target.value)}
                    placeholder="mazowieckie"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">Miasto</Label>
                  <Input
                    id="city"
                    value={city}
                    onChange={(event) => setCity(event.target.value)}
                    placeholder="Warszawa"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Rodzaj</Label>
                  <Select value={campType} onValueChange={setCampType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Wybierz" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Półkolonie">Półkolonie</SelectItem>
                      <SelectItem value="Obóz">Obóz</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cat">Kategoria</Label>
                  <Input
                    id="cat"
                    value={category}
                    onChange={(event) => setCategory(event.target.value)}
                    placeholder="jeździeckie / kajakarskie"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Metoda wyszukiwania</Label>
                  <Select value={method} onValueChange={setMethod}>
                    <SelectTrigger>
                      <SelectValue placeholder="Wybierz" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Wszystkie</SelectItem>
                      <SelectItem value="GOOGLE">Google index</SelectItem>
                      <SelectItem value="FACEBOOK">Facebook profile</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Notatka do zapytania</Label>
                  <Textarea
                    id="notes"
                    value={queryNotes}
                    onChange={(event) => setQueryNotes(event.target.value)}
                    placeholder="np. dodatkowe frazy lub priorytet"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Podgląd dorka</Label>
                <Textarea value={dorkPreview} readOnly />
              </div>

              <Button
                onClick={handleCreate}
                disabled={
                  createJob.isLoading ||
                  !category.trim()
                }
              >
                {createJob.isLoading ? "Zapisuję..." : "Zapisz job"}
              </Button>

              {createJob.error && (
                <p className="text-sm text-red-600">
                  {createJob.error.message}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ostatnie joby</CardTitle>
              <CardDescription>
                Dane wejściowe do uruchamiania scrapera z CLI.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {jobsQuery.isLoading && (
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Ładowanie...
                </p>
              )}
              {jobsQuery.data?.length === 0 && (
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Brak zapisanych jobów.
                </p>
              )}
              <ul className="space-y-3 text-sm">
                {jobsQuery.data?.map((job) => (
                  <li
                    key={job.id}
                    className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800"
                  >
                    <div className="font-medium">
                      #{job.id} · {job.city} · {job.campType}
                    </div>
                    <div className="text-zinc-600 dark:text-zinc-400">
                      {job.wojewodztwo} · {job.category} · {job.method ?? 'ALL'}
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => navigator.clipboard.writeText(JSON.stringify(job, null, 2))}>
                        Kopiuj job
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Ostatnie leady (raw_leads)</CardTitle>
                <CardDescription>
                  Kontrola kwarantanny przed dalszym CRM.
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={async () => {
                    try {
                      const res = await categorizeAll.mutateAsync();
                      leadsQuery.refetch();
                      const ok = res?.ok ? "OK" : "FAILED";
                      alert(`Kategoryzacja zbiorcza zakończona: ${ok}. Przetworzono: ${res?.results?.length ?? 0}`);
                    } catch (err) {
                      console.error(err);
                      alert(`Błąd: ${(err as Error).message}`);
                    }
                  }}
                >
                  Kategoryzuj wszystkie
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {leadsQuery.isLoading && (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Ładowanie...
              </p>
            )}
            {leadsQuery.data?.length === 0 && (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Brak zapisanych leadów.
              </p>
            )}
            <ul className="grid gap-3 text-sm md:grid-cols-2">
              {leadsQuery.data?.map((lead) => (
                <li
                  key={lead.id}
                  className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800"
                >
                  <div className="font-medium">
                    #{lead.id} · {lead.organizationName ?? "(brak nazwy)"}
                  </div>
                  <div className="text-zinc-600 dark:text-zinc-400 flex items-center gap-3">
                    <div>{lead.city ?? ""} · {lead.category ?? ""}</div>
                    <div className="text-xs rounded-md bg-zinc-100 px-2 py-1 dark:bg-zinc-800">
                      {lead.status ?? "NEW"}
                    </div>
                    {lead.verified && (
                      <div className="text-xs rounded-md bg-green-100 px-2 py-1 dark:bg-green-800 text-green-800 dark:text-white">
                        Zweryfikowany
                      </div>
                    )}
                  </div>
                  <div className="text-zinc-600 dark:text-zinc-400">
                    tel: {lead.phoneNormalized ?? "brak"}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      asChild
                    >
                      <a href={lead.socialUrl ?? lead.websiteUrl ?? "#"} target="_blank" rel="noreferrer">Źródło</a>
                    </Button>

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setSelectedLeadJson(JSON.stringify(lead, null, 2))}
                    >
                      Pokaż JSON
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </main>

      {selectedLeadJson && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center"
        >
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setSelectedLeadJson(null)}
          />

          <div className="relative max-w-3xl w-full mx-4 rounded bg-white dark:bg-zinc-900 shadow-lg">
            <div className="flex items-center justify-between border-b px-4 py-2">
              <div className="font-medium">JSON leada</div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => navigator.clipboard.writeText(selectedLeadJson)}
                >
                  Kopiuj
                </Button>
                <Button size="sm" onClick={() => setSelectedLeadJson(null)}>
                  Zamknij
                </Button>
              </div>
            </div>
            <div className="p-4">
              <pre className="max-h-[60vh] overflow-auto rounded bg-black p-4 text-white">
                {selectedLeadJson}
              </pre>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
