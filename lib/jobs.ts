export type Job = {
  id: string;
  title: string;
  company: string;
  location: string;
  description: string;
  requiredSkills: string[];
  preferredSkills: string[];
  mentionedSkills: string[];
  url: string;
  created: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryIsPredicted: boolean | null;
  locationArea: string[];
};

type AdzunaListing = {
  id?: string | number;
  title?: string;
  description?: string;
  redirect_url?: string;
  created?: string;
  salary_min?: number;
  salary_max?: number;
  salary_is_predicted?: number | string;
  company?: { display_name?: string };
  location?: { display_name?: string; area?: string[] };
};

export function normalizeJob(listing: AdzunaListing): Job {
  const description = listing.description?.trim() || "";
  const skillSummary = summarizeSkills(description);
  return {
    id: String(listing.id ?? listing.redirect_url ?? `${listing.title}-${listing.company?.display_name}`),
    title: listing.title?.trim() || "Untitled role",
    company: listing.company?.display_name?.trim() || "Company not listed",
    location: listing.location?.display_name?.trim() || "",
    description,
    requiredSkills: skillSummary.required,
    preferredSkills: skillSummary.preferred,
    mentionedSkills: skillSummary.mentioned,
    url: listing.redirect_url || "#",
    created: listing.created || null,
    salaryMin: Number.isFinite(listing.salary_min) ? listing.salary_min! : null,
    salaryMax: Number.isFinite(listing.salary_max) ? listing.salary_max! : null,
    salaryIsPredicted: listing.salary_is_predicted === 1 || listing.salary_is_predicted === "1" ? true : listing.salary_is_predicted === 0 || listing.salary_is_predicted === "0" ? false : null,
    locationArea: Array.isArray(listing.location?.area) ? listing.location.area.filter((part): part is string => typeof part === "string") : [],
  };
}

const SKILL_TERMS = [
  "SQL", "Python", "R", "Excel", "Power BI", "Tableau", "Looker", "Snowflake",
  "AWS", "Azure", "Google Cloud", "GCP", "Hadoop", "Spark", "Machine Learning",
  "Data Visualization", "Data Modeling", "ETL", "Statistics", "Analytics", "Forecasting",
  "Communication", "Stakeholder Management", "Project Management", "Agile", "Scrum",
  "Salesforce", "React", "Node.js", "JavaScript", "TypeScript", "Java", "C++", "HTML",
  "CSS", "Git", "Linux", "Docker", "Kubernetes", "Accounting", "Budgeting", "CRM",
  "Customer Service", "Leadership", "Research", "Writing", "Problem Solving",
];

const SECTION_MARKERS: Array<{ kind: "required" | "preferred"; pattern: RegExp }> = [
  { kind: "required", pattern: /\b(?:required(?:\s+(?:skills?|qualifications?|experience))?|requirements?|qualifications?|must[-\s]?have|essential(?:\s+skills?)?|what you(?:'|’)ll need|what you need|key criteria)\s*:?/gi },
  { kind: "preferred", pattern: /\b(?:preferred(?:\s+(?:skills?|qualifications?|experience))?|nice[-\s]+to[-\s]+have|desirable(?:\s+skills?)?|bonus(?:\s+skills?)?|good to have|would be an advantage)\s*:?/gi },
];

function findSkills(text: string) {
  return SKILL_TERMS.filter((skill) => {
    const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}([^\\p{L}\\p{N}]|$)`, "iu").test(text);
  });
}

function summarizeSkills(description: string) {
  const markers: Array<{ index: number; end: number; kind: "required" | "preferred" }> = [];
  for (const section of SECTION_MARKERS) {
    for (const match of description.matchAll(section.pattern)) {
      markers.push({ index: match.index ?? 0, end: (match.index ?? 0) + match[0].length, kind: section.kind });
    }
  }
  markers.sort((a, b) => a.index - b.index);

  const explicit: Record<"required" | "preferred", string[]> = { required: [], preferred: [] };
  for (let index = 0; index < markers.length; index++) {
    const marker = markers[index];
    const nextMarker = markers[index + 1]?.index ?? description.length;
    const sectionText = description.slice(marker.end, Math.min(nextMarker, marker.end + 650));
    explicit[marker.kind].push(...findSkills(sectionText));
  }

  const unique = (skills: string[]) => [...new Set(skills)];
  const required = unique(explicit.required);
  const preferred = unique(explicit.preferred);
  return {
    required,
    preferred,
    mentioned: required.length || preferred.length ? [] : findSkills(description),
  };
}
