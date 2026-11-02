export type EvidenceSource = {
  id: string;
  type: "pubmed";
  title: string;
  authors: string;
  journal: string;
  publishedAt: string;
  abstract: string;
  url: string;
};

const EUTILS = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/";

function textOf(node: Element | null, tag: string): string {
  return node?.getElementsByTagName(tag)?.[0]?.textContent?.trim() || "";
}

/** PubMed E-utilities: search IDs, then retrieve abstracts and bibliographic data. */
export async function searchPubMedEvidence(query: string, maxResults = 8): Promise<EvidenceSource[]> {
  const term = query.trim();
  if (!term) return [];
  const searchUrl = new URL(EUTILS + "esearch.fcgi");
  searchUrl.search = new URLSearchParams({
    db: "pubmed", term, retmax: String(Math.min(Math.max(maxResults, 1), 10)),
    retmode: "json", sort: "relevance",
  }).toString();

  const searchResponse = await fetch(searchUrl.toString());
  if (!searchResponse.ok) throw new Error("PubMed search failed (" + searchResponse.status + ").");
  const searchJson = await searchResponse.json();
  const ids: string[] = searchJson?.esearchresult?.idlist || [];
  if (!ids.length) return [];

  const fetchUrl = new URL(EUTILS + "efetch.fcgi");
  fetchUrl.search = new URLSearchParams({ db: "pubmed", id: ids.join(","), retmode: "xml" }).toString();
  const fetchResponse = await fetch(fetchUrl.toString());
  if (!fetchResponse.ok) throw new Error("PubMed abstract retrieval failed (" + fetchResponse.status + ").");
  const xmlText = await fetchResponse.text();
  const xml = new DOMParser().parseFromString(xmlText, "application/xml");
  if (xml.querySelector("parsererror")) throw new Error("PubMed returned malformed XML.");

  return Array.from(xml.querySelectorAll("PubmedArticle")).map((article): EvidenceSource => {
    const pmid = textOf(article, "PMID");
    const title = textOf(article, "ArticleTitle").replace(/\s+/g, " ");
    const journal = textOf(article, "Title");
    const year = textOf(article, "Year") || textOf(article, "PubDate");
    const authorNodes = Array.from(article.querySelectorAll("AuthorList Author")).slice(0, 3);
    const authors = authorNodes.map((author) => {
      const last = textOf(author, "LastName");
      const initials = textOf(author, "Initials");
      return [last, initials].filter(Boolean).join(" ");
    }).filter(Boolean).join(", ");
    const abstract = Array.from(article.querySelectorAll("Abstract AbstractText"))
      .map((node) => {
        const label = node.getAttribute("Label");
        return (label ? label + ": " : "") + (node.textContent || "").trim();
      }).filter(Boolean).join("\n");
    return {
      id: "S" + pmid, type: "pubmed", title: title || "Untitled PubMed record",
      authors: authors || "Authors not listed", journal: journal || "Journal not listed",
      publishedAt: year || "Date not listed", abstract: abstract || "No abstract available in PubMed.",
      url: "https://pubmed.ncbi.nlm.nih.gov/" + pmid + "/",
    };
  }).filter((source) => source.id !== "S");
}

export type GuidelinePortal = { name: string; region: string; url: string; note: string };

export function getGuidelinePortals(query: string): GuidelinePortal[] {
  const q = encodeURIComponent(query.trim());
  return [
    { name: "WHO publications", region: "Global", url: "https://www.who.int/publications/i?search=" + q, note: "Check document date, scope and applicable population." },
    { name: "NICE guidance", region: "United Kingdom", url: "https://www.nice.org.uk/search?q=" + q, note: "National guideline portal; applicability may vary by country." },
    { name: "CDC", region: "United States", url: "https://search.cdc.gov/search/?query=" + q, note: "Public-health and US-specific guidance." },
    { name: "GINA", region: "Global · asthma", url: "https://ginasthma.org/", note: "Asthma strategy reports and updates." },
    { name: "Nepal Department of Health Services", region: "Nepal", url: "https://www.dohs.gov.np/", note: "Check Nepal-specific programme and national guidance." },
    { name: "India MoHFW", region: "India · South Asia", url: "https://www.mohfw.gov.in/", note: "Official national guidance and programmes." },
  ];
}
