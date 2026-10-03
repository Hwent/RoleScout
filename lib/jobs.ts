export type Job = {
  id: string;
  title: string;
  company: string;
  location: string;
  description: string;
  url: string;
  created: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
};

type AdzunaListing = {
  id?: string | number;
  title?: string;
  description?: string;
  redirect_url?: string;
  created?: string;
  salary_min?: number;
  salary_max?: number;
  company?: { display_name?: string };
  location?: { display_name?: string };
};

export function normalizeJob(listing: AdzunaListing): Job {
  return {
    id: String(listing.id ?? listing.redirect_url ?? `${listing.title}-${listing.company?.display_name}`),
    title: listing.title?.trim() || "Untitled role",
    company: listing.company?.display_name?.trim() || "Company not listed",
    location: listing.location?.display_name?.trim() || "",
    description: listing.description?.trim() || "",
    url: listing.redirect_url || "#",
    created: listing.created || null,
    salaryMin: Number.isFinite(listing.salary_min) ? listing.salary_min! : null,
    salaryMax: Number.isFinite(listing.salary_max) ? listing.salary_max! : null,
  };
}
