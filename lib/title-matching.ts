const JOB_TITLE_WORDS = [
  "account", "accountant", "accounting", "administrator", "analyst", "architect", "assistant", "associate", "auditor", "backend", "bookkeeper",
  "business", "carpenter", "cashier", "chef", "civil", "consultant", "coordinator", "customer", "cybersecurity", "data",
  "designer", "developer", "director", "electrical", "engineer", "end", "entry", "executive", "finance", "financial", "front", "graphic", "human",
  "industrial", "junior", "lead", "manager", "marketing", "mechanical", "mobile", "nurse", "nursing", "operations", "pharmacist", "physician", "principal", "product",
  "program", "project", "recruiter", "representative", "researcher", "sales", "scientist", "security", "senior", "service", "social",
  "software", "specialist", "staff", "stack", "support", "teacher", "technician", "technologist", "therapist", "web", "writer",
];

function editDistance(left: string, right: string) {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let row = 1; row <= left.length; row++) {
    let diagonal = previous[0];
    previous[0] = row;
    for (let column = 1; column <= right.length; column++) {
      const above = previous[column];
      previous[column] = Math.min(previous[column] + 1, previous[column - 1] + 1, diagonal + (left[row - 1] === right[column - 1] ? 0 : 1));
      diagonal = above;
    }
  }
  return previous[right.length];
}

/** Correct one obvious misspelling in a common job-title word; leave ambiguous words untouched. */
export function correctJobTitle(title: string) {
  const words = title.match(/[\p{L}\p{N}]+|[^\p{L}\p{N}]+/gu) ?? [title];
  let changed = false;
  const corrected = words.map((part) => {
    if (!/^[\p{L}\p{N}]+$/u.test(part) || part.length < 5) return part;
    const token = part.toLocaleLowerCase();
    if (JOB_TITLE_WORDS.includes(token)) return part;
    const maxDistance = token.length >= 6 ? 2 : 1;
    const candidates = JOB_TITLE_WORDS
      .map((word) => ({ word, distance: editDistance(token, word) }))
      .filter((item) => item.distance <= maxDistance)
      .sort((a, b) => a.distance - b.distance);
    if (!candidates.length || candidates[1]?.distance === candidates[0].distance) return part;
    changed = true;
    const replacement = candidates[0].word;
    return part[0] === part[0].toLocaleUpperCase()
      ? replacement[0].toLocaleUpperCase() + replacement.slice(1)
      : replacement;
  }).join("");
  return { title: corrected, corrected: changed };
}
