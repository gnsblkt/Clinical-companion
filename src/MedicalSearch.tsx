import React, { useState, type FormEvent } from "react";
import { Activity, ArrowLeft, BookOpen, ExternalLink, Image as ImageIcon, Search, ShieldCheck, GitBranch, Layers, Landmark, Brain, ClipboardList } from "lucide-react";

type Article = { id: string; title: string; journal?: string; date?: string; url: string; abstract?: string };
type WikiItem = { title: string; extract: string; url: string; thumbnail?: string };
type ImageItem = { title: string; thumb: string; page: string; license: string; artist: string; credit: string };

const endpoint = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/";

async function getPubMed(query: string): Promise<Article[]> {
  const searchUrl = new URL(endpoint + "esearch.fcgi");
  searchUrl.search = new URLSearchParams({ db: "pubmed", term: query, retmax: "6", retmode: "json", sort: "relevance" }).toString();
  const searchResponse = await fetch(searchUrl);
  if (!searchResponse.ok) throw new Error("PubMed search is unavailable right now.");
  const searchData = await searchResponse.json();
  const ids: string[] = searchData?.esearchresult?.idlist || [];
  if (!ids.length) return [];
  const summaryUrl = new URL(endpoint + "esummary.fcgi");
  summaryUrl.search = new URLSearchParams({ db: "pubmed", id: ids.join(","), retmode: "json" }).toString();
  const summaryResponse = await fetch(summaryUrl);
  if (!summaryResponse.ok) throw new Error("PubMed article details could not be loaded.");
  const summaryData = await summaryResponse.json();
  return ids.map((id) => {
    const item = summaryData?.result?.[id] || {};
    return {
      id,
      title: String(item.title || "Untitled article").replace(/<[^>]+>/g, ""),
      journal: item.fulljournalname || item.source || "PubMed indexed journal",
      date: item.pubdate || "",
      url: "https://pubmed.ncbi.nlm.nih.gov/" + id + "/",
    };
  });
}

type GuidelineSource = { name: string; region: string; description: string; url: string };

function getGuidelineSources(query: string): GuidelineSource[] {
  const q = encodeURIComponent(query.trim());
  return [
    { name: "World Health Organization", region: "International", description: "Official publications and guidance; check the document scope and date.", url: "https://www.who.int/publications/i?search=" + q },
    { name: "NICE guidance", region: "United Kingdom", description: "Evidence-based guidance and recommendations for the stated population.", url: "https://www.nice.org.uk/search?q=" + q },
    { name: "CDC", region: "United States", description: "US public-health guidance and clinical information where relevant.", url: "https://search.cdc.gov/search/?query=" + q },
    { name: "India Ministry of Health and Family Welfare", region: "India", description: "Check official national programmes and current standard treatment guidance.", url: "https://www.mohfw.gov.in/" },
    { name: "Department of Health Services", region: "Nepal", description: "Check official Nepal health guidance, programmes, and publications.", url: "https://www.dohs.gov.np/" },
  ];
}

async function getWikipedia(query: string): Promise<WikiItem[]> {
  const url = new URL("https://en.wikipedia.org/w/api.php");
  url.search = new URLSearchParams({ action: "query", list: "search", srsearch: query, srlimit: "5", format: "json", origin: "*" }).toString();
  const response = await fetch(url);
  if (!response.ok) throw new Error("Wikipedia search is unavailable right now.");
  const data = await response.json();
  const results: WikiItem[] = (data?.query?.search || []).map((item: { title: string; snippet: string }) => ({
    title: item.title,
    extract: String(item.snippet || "").replace(/<[^>]+>/g, "").replace(/&quot;/g, '"').replace(/&#039;/g, "'"),
    url: "https://en.wikipedia.org/wiki/" + encodeURIComponent(item.title.replace(/ /g, "_")),
  }));

  // Fetch thumbnails for the same Wikipedia pages so every image links back to its article.
  if (results.length) {
    const imageUrl = new URL("https://en.wikipedia.org/w/api.php");
    imageUrl.search = new URLSearchParams({
      action: "query", prop: "pageimages", titles: results.map((item) => item.title).join("|"),
      piprop: "thumbnail", pithumbsize: "640", format: "json", origin: "*",
    }).toString();
    const imageResponse = await fetch(imageUrl);
    if (imageResponse.ok) {
      const imageData = await imageResponse.json();
      const pages = Object.values(imageData?.query?.pages || {}) as Array<{ title?: string; thumbnail?: { source?: string } }>;
      const thumbnails = new Map(pages.map((page) => [page.title, page.thumbnail?.source]));
      return results.map((item) => ({ ...item, thumbnail: thumbnails.get(item.title) }));
    }
  }
  return results;
}

async function getCommons(query: string): Promise<ImageItem[]> {
  const url = new URL("https://commons.wikimedia.org/w/api.php");
  url.search = new URLSearchParams({
    action: "query", generator: "search", gsrsearch: query + " medical", gsrnamespace: "6", gsrlimit: "6",
    prop: "imageinfo", iiprop: "url|extmetadata", iiurlwidth: "640", format: "json", origin: "*",
  }).toString();
  const response = await fetch(url);
  if (!response.ok) throw new Error("Wikimedia Commons image search is unavailable right now.");
  const data = await response.json();
  return Object.values(data?.query?.pages || {}).map((raw: any) => {
    const item = raw as { title?: string; imageinfo?: Array<{ thumburl?: string; url?: string; descriptionurl?: string; extmetadata?: Record<string, { value?: string }> }> };
    const info = item.imageinfo?.[0];
    const meta = info?.extmetadata || {};
    const clean = (value?: string) => String(value || "").replace(/<[^>]*>/g, "").replace(/&quot;/g, '"').trim();
    return {
      title: String(item.title || "Medical illustration").replace(/^File:/, ""),
      thumb: info?.thumburl || info?.url || "",
      page: info?.descriptionurl || info?.url || "https://commons.wikimedia.org/",
      license: clean(meta.LicenseShortName?.value) || "License details on source page",
      artist: clean(meta.Artist?.value) || "Creator listed on source page",
      credit: clean(meta.Attribution?.value) || clean(meta.Credit?.value) || "See source page for attribution",
    };
  }).filter((item) => item.thumb);
}

export default function MedicalSearch() {
  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sourceErrors, setSourceErrors] = useState<string[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [guidelines, setGuidelines] = useState<Article[]>([]);
  const [wiki, setWiki] = useState<WikiItem[]>([]);
  const [images, setImages] = useState<ImageItem[]>([]);
  const [studyTool, setStudyTool] = useState<"flashcards" | "compare" | "flowchart">("flashcards");
  const [cardQuestion, setCardQuestion] = useState("");
  const [cardAnswer, setCardAnswer] = useState("");
  const [flashcards, setFlashcards] = useState<Array<{ question: string; answer: string }>>([]);
  const [revealedCards, setRevealedCards] = useState<number[]>([]);

  function addFlashcard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const question = cardQuestion.trim();
    const answer = cardAnswer.trim();
    if (!question || !answer) return;
    setFlashcards((current) => [...current, { question, answer }]);
    setCardQuestion("");
    setCardAnswer("");
  }

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const term = query.trim();
    if (!term || loading) return;
    setLoading(true); setError(""); setSourceErrors([]); setActiveQuery(term);
    const results = await Promise.allSettled([getPubMed(term), getPubMed(term + " AND (guideline[Publication Type] OR practice guideline[Publication Type])"), getWikipedia(term), getCommons(term)]);
    const failures: string[] = [];
    if (results[0].status === "fulfilled") setArticles(results[0].value);
    else { setArticles([]); failures.push("PubMed"); }
    if (results[1].status === "fulfilled") setGuidelines(results[1].value);
    else { setGuidelines([]); failures.push("PubMed guideline filter"); }
    if (results[2].status === "fulfilled") setWiki(results[2].value);
    else { setWiki([]); failures.push("Wikipedia"); }
    if (results[3].status === "fulfilled") setImages(results[3].value);
    else { setImages([]); failures.push("Wikimedia Commons"); }
    setSourceErrors(failures);
    if (failures.length === 4) setError("All sources failed to respond. Check your connection and try again.");
    setLoading(false);
  }

  return <div className="medsearch-shell">
    <header className="medsearch-header">
      <a className="medsearch-back" href="/" aria-label="Back to Clinical Companion"><ArrowLeft size={17}/> Study workspace</a>
      <div className="medsearch-brand"><span><Activity size={21}/></span><div><strong>MedAtlas</strong><small>MEDICAL LITERATURE SEARCH</small></div></div>
      <span className="medsearch-pill"><ShieldCheck size={14}/> Source-linked results</span>
    </header>
    <main className="medsearch-main">
      <section className="medsearch-hero">
        <span className="medsearch-eyebrow">SEARCH · VERIFY · LEARN</span>
        <h1>Find the evidence<br/><em>behind the answer.</em></h1>
        <p>Search biomedical literature, medical topic summaries, and reusable educational images from established public sources.</p>
        <form className="medsearch-form" onSubmit={search}>
          <Search size={21}/>
          <input aria-label="Medical topic" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Try: diabetic ketoacidosis, tuberculosis…" maxLength={180}/>
          <button type="submit" disabled={!query.trim() || loading}>{loading ? "Searching…" : "Search"}</button>
        </form>
        <div className="medsearch-suggestions"><span>Explore:</span>{["asthma", "iron deficiency anemia", "sepsis", "nephrotic syndrome"].map((term) => <button key={term} onClick={() => { setQuery(term); }} type="button">{term}</button>)}</div>
      </section>

      <div className="medsearch-disclaimer"><ShieldCheck size={17}/><p><strong>For medical education.</strong> Search results are not clinical recommendations. Check publication dates, study design, full text, and current local guidelines before relying on a finding.</p></div>
      {error && <div className="medsearch-error" role="alert">{error}</div>}
      {sourceErrors.length > 0 && sourceErrors.length < 3 && <div className="medsearch-warning" role="status">Some sources did not respond: {sourceErrors.join(", ")}. Other available results are shown.</div>}

      {activeQuery && <div className="medsearch-results-head"><div><span>SEARCH RESULTS</span><h2>{activeQuery}</h2></div>{!loading && <small>Results are fetched live from public APIs</small>}</div>}
      {loading && <div className="medsearch-loading"><span className="medsearch-spinner"/><p>Searching biomedical literature and reference sources…</p></div>}

      {activeQuery && !loading && <nav className="medatlas-workspace-nav" aria-label="Topic workspace sections">
        <a href="#guidelines"><Landmark size={15}/> Guidelines</a>
        <a href="#literature"><BookOpen size={15}/> Research</a>
        <a href="#visuals"><ImageIcon size={15}/> Images</a>
        <a href="#study-tools"><Brain size={15}/> Study tools</a>
      </nav>}

      {!loading && activeQuery && <>
        <section className="medsearch-section" id="guidelines">
          <div className="medsearch-section-title"><span className="medsearch-icon amber"><Landmark size={19}/></span><div><h3>Guidelines and recommendations</h3><p>Official source portals plus PubMed-indexed guideline records</p></div><span className="medsearch-count">{guidelines.length} records</span></div>
          <p className="medsearch-source-note">These are discovery links, not an endorsement of every result. Confirm the issuing organization, intended population, jurisdiction, publication/update date, and whether the guidance is still current.</p>
          <div className="medsearch-guideline-grid">{getGuidelineSources(activeQuery).map((source) => <article className="medsearch-guideline-card" key={source.name}><span>{source.region}</span><h4>{source.name}</h4><p>{source.description}</p><a className="medsearch-source-link" href={source.url} target="_blank" rel="noreferrer">Open source portal ↗</a></article>)}</div>
          {guidelines.length ? <div className="medsearch-article-list medsearch-guideline-records">{guidelines.map((article) => <article className="medsearch-article" key={article.id}><div className="medsearch-article-meta">{article.journal}{article.date ? " · " + article.date : ""}</div><h4><a href={article.url} target="_blank" rel="noreferrer">{article.title}<ExternalLink size={14}/></a></h4><p>Returned by a clinical-practice-guideline publication-type search. Verify article type, full document, scope, and currency before using it as a recommendation.</p><a className="medsearch-source-link" href={article.url} target="_blank" rel="noreferrer">Review PubMed record ↗</a></article>)}</div> : <p className="medsearch-empty">No PubMed records were returned by the guideline filter. Use the official source portals above as well; guidelines may not be indexed consistently.</p>}
        </section>

        <section className="medsearch-section" id="literature">
          <div className="medsearch-section-title"><span className="medsearch-icon"><BookOpen size={19}/></span><div><h3>Biomedical literature</h3><p>PubMed · National Library of Medicine</p></div><span className="medsearch-count">{articles.length} results</span></div>
          {articles.length ? <div className="medsearch-article-list">{articles.map((article) => <article className="medsearch-article" key={article.id}><div className="medsearch-article-meta">{article.journal}{article.date ? " · " + article.date : ""}</div><h4><a href={article.url} target="_blank" rel="noreferrer">{article.title}<ExternalLink size={14}/></a></h4><p>Open the PubMed record to review the abstract, indexing details, publication information, and links to full text where available.</p><a className="medsearch-source-link" href={article.url} target="_blank" rel="noreferrer">View PubMed record ↗</a></article>)}</div> : <p className="medsearch-empty">No PubMed records found for this query.</p>}
        </section>

        <section className="medsearch-section">
          <div className="medsearch-section-title"><span className="medsearch-icon violet"><BookOpen size={19}/></span><div><h3>Topic overview</h3><p>Wikipedia · tertiary orientation only</p></div><span className="medsearch-count">{wiki.length} results</span></div>
          {wiki.length ? <div className="medsearch-wiki-grid">{wiki.map((item) => <article className="medsearch-wiki-card" key={item.title}><h4><a href={item.url} target="_blank" rel="noreferrer">{item.title}<ExternalLink size={13}/></a></h4><p>{item.extract || "Open the article for a general topic overview."}</p><a className="medsearch-source-link" href={item.url} target="_blank" rel="noreferrer">Read article ↗</a></article>)}</div> : <p className="medsearch-empty">No topic pages found for this query.</p>}
        </section>

        <section className="medsearch-section" id="visuals">
          <div className="medsearch-section-title"><span className="medsearch-icon teal"><ImageIcon size={19}/></span><div><h3>Educational images</h3><p>Wikimedia Commons · license metadata shown where available</p></div><span className="medsearch-count">{images.length} results</span></div>
          <div className="medsearch-image-search-links"><a href={`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(activeQuery + " medical illustration")}`} target="_blank" rel="noreferrer">Browse Google Images ↗</a><a href={`https://commons.wikimedia.org/w/index.php?search=${encodeURIComponent(activeQuery + " medical")}&title=Special:MediaSearch&type=image`} target="_blank" rel="noreferrer">More open-media results ↗</a><p>External image-search results may have copyright or license restrictions. Open the original source and verify permission before reuse.</p></div>
          {images.length ? <div className="medsearch-image-grid">{images.map((item) => <article className="medsearch-image-card" key={item.page}><a className="medsearch-image" href={item.page} target="_blank" rel="noreferrer"><img src={item.thumb} alt={item.title} loading="lazy"/></a><div className="medsearch-image-info"><h4><a href={item.page} target="_blank" rel="noreferrer">{item.title}</a></h4><p><strong>License:</strong> {item.license}</p><p><strong>Creator:</strong> {item.artist}</p><p><strong>Credit:</strong> {item.credit}</p><a className="medsearch-source-link" href={item.page} target="_blank" rel="noreferrer">Source & license ↗</a></div></article>)}</div> : <p className="medsearch-empty">No Commons images found for this query.</p>}
        </section>

        <section className="medsearch-section">
          <div className="medsearch-section-title"><span className="medsearch-icon violet"><ImageIcon size={19}/></span><div><h3>Images from Wikipedia</h3><p>Article thumbnails · tap an image to open its Wikipedia page</p></div><span className="medsearch-count">{wiki.filter((item) => item.thumbnail).length} images</span></div>
          {wiki.some((item) => item.thumbnail) ? <div className="medsearch-image-grid">{wiki.filter((item) => item.thumbnail).map((item) => <article className="medsearch-image-card" key={item.url}><a className="medsearch-image" href={item.url} target="_blank" rel="noreferrer" aria-label={`Open Wikipedia article: ${item.title}`}><img src={item.thumbnail} alt={item.title} loading="lazy"/></a><div className="medsearch-image-info"><h4><a href={item.url} target="_blank" rel="noreferrer">{item.title} <ExternalLink size={13}/></a></h4><p>Image thumbnail from the linked Wikipedia article.</p><a className="medsearch-source-link" href={item.url} target="_blank" rel="noreferrer">Open Wikipedia page ↗</a></div></article>)}</div> : <p className="medsearch-empty">No article thumbnails are available for this search. Open a topic result above to explore its page.</p>}
        </section>

        <section className="medsearch-section" id="study-tools">
          <div className="medsearch-section-title"><span className="medsearch-icon violet"><Brain size={19}/></span><div><h3>Study tools</h3><p>Working tools for {activeQuery} · outputs are based on search metadata or notes you enter</p></div></div>
          <div className="medsearch-tool-tabs" role="tablist" aria-label="Choose study tool">
            <button type="button" role="tab" aria-selected={studyTool === "flashcards"} className={studyTool === "flashcards" ? "active" : ""} onClick={() => setStudyTool("flashcards")}><ClipboardList size={16}/> Flashcards</button>
            <button type="button" role="tab" aria-selected={studyTool === "compare"} className={studyTool === "compare" ? "active" : ""} onClick={() => setStudyTool("compare")}><Layers size={16}/> Compare papers</button>
            <button type="button" role="tab" aria-selected={studyTool === "flowchart"} className={studyTool === "flowchart" ? "active" : ""} onClick={() => setStudyTool("flowchart")}><GitBranch size={16}/> Evidence flow</button>
          </div>
          {studyTool === "flashcards" && <div className="medsearch-tool-panel">
            <h4>Create revision flashcards</h4>
            <p className="medsearch-source-note">Write answers from material you have reviewed. Cards are kept in this page session; source claims should be checked against the linked paper or guideline.</p>
            <form className="medsearch-flashcard-form" onSubmit={addFlashcard}>
              <label>Question or prompt<input value={cardQuestion} onChange={(e) => setCardQuestion(e.target.value)} placeholder={`e.g. What population does this ${activeQuery} paper study?`} maxLength={300} required /></label>
              <label>Answer / key points<textarea value={cardAnswer} onChange={(e) => setCardAnswer(e.target.value)} placeholder="Add your own notes and key points…" maxLength={1500} rows={3} required /></label>
              <button type="submit">Add flashcard</button>
            </form>
            <div className="medsearch-flashcard-toolbar"><strong>{flashcards.length} cards</strong><span>Tap a card to reveal or hide the answer</span></div>
            {flashcards.length ? <div className="medsearch-flashcard-list">{flashcards.map((card, index) => <button type="button" className="medsearch-flashcard" key={index} onClick={() => setRevealedCards((current) => current.includes(index) ? current.filter((n) => n !== index) : [...current, index])}><span> CARD {index + 1} · {revealedCards.includes(index) ? "ANSWER" : "QUESTION"}</span><strong>{revealedCards.includes(index) ? card.answer : card.question}</strong><small>{revealedCards.includes(index) ? "Tap to hide answer" : "Tap to reveal answer"}</small></button>)}</div> : <p className="medsearch-empty">No cards yet. Add a question and answer above to create your first revision card.</p>}
          </div>}
          {studyTool === "compare" && <div className="medsearch-tool-panel">
            <h4>Compare search results</h4>
            <p className="medsearch-source-note">This table compares indexed metadata only, not clinical outcomes or study quality. Open each source and read the abstract/full text before drawing conclusions.</p>
            {articles.length ? <div className="medsearch-comparison-wrap"><table className="medsearch-comparison-table"><thead><tr><th>Paper</th><th>Journal</th><th>Publication date</th><th>Source</th></tr></thead><tbody>{articles.map((article) => <tr key={article.id}><td>{article.title}</td><td>{article.journal || "Not listed"}</td><td>{article.date || "Not listed"}</td><td><a href={article.url} target="_blank" rel="noreferrer">PubMed ↗</a></td></tr>)}</tbody></table></div> : <p className="medsearch-empty">No paper records to compare yet. Search a topic with PubMed results first.</p>}
          </div>}
          {studyTool === "flowchart" && <div className="medsearch-tool-panel">
            <h4>Evidence review flow for {activeQuery}</h4>
            <p className="medsearch-source-note">This is a study workflow for evaluating sources, not a diagnostic or treatment algorithm.</p>
            <ol className="medsearch-evidence-flow">
              <li><strong>1. Define the question</strong><span>Specify population, clinical problem, intervention/exposure, comparator, and outcome where relevant.</span></li>
              <li><strong>2. Find current guidance</strong><span>Check the issuing body, jurisdiction, intended population, publication date, and update status.</span></li>
              <li><strong>3. Appraise the paper</strong><span>Review design, sample, methods, bias, effect estimates, uncertainty, and limitations in the original source.</span></li>
              <li><strong>4. Check applicability</strong><span>Compare the study population and setting with the question and local clinical context.</span></li>
              <li><strong>5. Record a qualified takeaway</strong><span>Summarize only what the source supports, note uncertainty, and keep a citation to the original record.</span></li>
            </ol>
            <div className="medsearch-flow-sources"><strong>Start with this topic's sources:</strong>{articles.slice(0, 3).map((article) => <a key={article.id} href={article.url} target="_blank" rel="noreferrer">{article.title} ↗</a>)}{guidelines.slice(0, 2).map((article) => <a key={article.id} href={article.url} target="_blank" rel="noreferrer">Guideline record: {article.title} ↗</a>)}{articles.length === 0 && guidelines.length === 0 && <span>No indexed records returned. Use the official guideline portals above.</span>}</div>
          </div>}
        </section>
      </>}

      {!activeQuery && <section className="medsearch-start-grid"><article><BookOpen/><h3>Research papers</h3><p>Find indexed articles and open the original PubMed record.</p></article><article><Activity/><h3>Topic summaries</h3><p>Start with a general overview, then verify important details with primary sources.</p></article><article><ImageIcon/><h3>Reusable visuals</h3><p>Inspect creator and license information before using an illustration.</p></article></section>}
      <footer className="medsearch-footer">MedAtlas · Evidence discovery for learning · Not a diagnostic or treatment tool</footer>
    </main>
  </div>;
}
