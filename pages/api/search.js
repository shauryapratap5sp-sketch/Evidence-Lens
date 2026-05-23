export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { condition, region } = req.body
  if (!condition) return res.status(400).json({ error: 'No condition provided' })

  // Tricity institution OpenAlex IDs — PGIMER and GMCH Chandigarh
  const TRICITY_INSTITUTION_IDS = [
    'I4210148109', // PGIMER Chandigarh
    'I4210148200', // GMCH Chandigarh
    'I4210149001', // PGI affiliated
  ]

  // Strict affiliation keywords — any result must match at least one
  const TRICITY_AFFILIATION_KEYWORDS = [
    'chandigarh', 'pgimer', 'pgi', 'post graduate institute',
    'gmch', 'government medical college chandigarh',
    'panchkula', 'mohali', 'tricity', 'sector 12', 'sector 32',
    'pb no', 'chandigarh 160', 'pin 160'
  ]

  const PSYCHIATRY_CONDITIONS = {
    depression: { mesh: 'depressive disorder', keywords: ['depression', 'depressive', 'antidepressant', 'MDD', 'major depressive', 'PHQ', 'HDRS', 'MADRS'] },
    anxiety: { mesh: 'anxiety disorders', keywords: ['anxiety', 'GAD', 'panic disorder', 'generalised anxiety', 'social anxiety', 'HAMA'] },
    schizophrenia: { mesh: 'schizophrenia', keywords: ['schizophrenia', 'psychosis', 'antipsychotic', 'schizophrenic', 'PANSS', 'clozapine', 'olanzapine'] },
    bipolar: { mesh: 'bipolar disorder', keywords: ['bipolar', 'mania', 'manic', 'mood disorder', 'lithium', 'valproate', 'YMRS'] },
    ocd: { mesh: 'obsessive-compulsive disorder', keywords: ['OCD', 'obsessive compulsive', 'obsession', 'compulsion', 'YBOCS'] },
    adhd: { mesh: 'attention deficit disorder with hyperactivity', keywords: ['ADHD', 'attention deficit', 'hyperactivity', 'hyperkinetic', 'methylphenidate'] },
    ptsd: { mesh: 'stress disorders post-traumatic', keywords: ['PTSD', 'post traumatic', 'trauma', 'post-traumatic stress', 'PCL'] },
    autism: { mesh: 'autistic disorder', keywords: ['autism', 'ASD', 'autistic', 'autism spectrum', 'CARS', 'ADOS'] },
    addiction: { mesh: 'substance-related disorders', keywords: ['addiction', 'substance use', 'alcohol dependence', 'drug abuse', 'de-addiction', 'opioid', 'dependence'] },
    suicide: { mesh: 'suicidal ideation', keywords: ['suicide', 'suicidal', 'self harm', 'deliberate self harm', 'parasuicide', 'SIQ'] },
    dementia: { mesh: 'dementia', keywords: ['dementia', 'alzheimer', 'cognitive decline', 'memory disorder', 'MMSE', 'MCI'] },
    eating: { mesh: 'feeding and eating disorders', keywords: ['eating disorder', 'anorexia', 'bulimia', 'binge eating', 'EDE'] },
  }

  const condLower = condition.toLowerCase()
  let matched = null
  for (const [key, val] of Object.entries(PSYCHIATRY_CONDITIONS)) {
    if (condLower.includes(key) || val.keywords.some(k => condLower.includes(k.toLowerCase()))) {
      matched = val
      break
    }
  }
  const searchTerm = matched ? matched.mesh : condition
  const keywords = matched ? matched.keywords : [condition]

  function reconstructAbstract(inv) {
    if (!inv) return ''
    const words = []
    for (const [w, positions] of Object.entries(inv)) {
      for (const p of positions) words.push([p, w])
    }
    return words.sort((a, b) => a[0] - b[0]).map(x => x[1]).join(' ')
  }

  function semanticScore(title, abstract, kws) {
    const text = ((title || '') + ' ' + (abstract || '')).toLowerCase()
    let hits = 0
    for (const kw of kws) { if (text.includes(kw.toLowerCase())) hits++ }
    return Math.min(1, (hits / Math.max(1, kws.length)) * 1.3 + 0.1)
  }

  function isTricity(cluster) {
    const allText = [
      ...cluster.rawAffiliations,
      ...cluster.institutions,
    ].join(' ').toLowerCase()
    return TRICITY_AFFILIATION_KEYWORDS.some(k => allText.includes(k))
  }

  function tricityScore(cluster) {
    const allText = [
      ...cluster.rawAffiliations,
      ...cluster.institutions,
    ].join(' ').toLowerCase()
    const hits = TRICITY_AFFILIATION_KEYWORDS.filter(k => allText.includes(k)).length
    if (hits >= 3) return 1.0
    if (hits === 2) return 0.85
    if (hits === 1) return 0.65
    return 0.0
  }

  try {
    const allWorks = []
    const seen = new Set()

    function addWorks(works) {
      for (const w of works) {
        if (!seen.has(w.id)) { seen.add(w.id); allWorks.push(w) }
      }
    }

    const SELECT = 'id,title,abstract_inverted_index,publication_year,doi,cited_by_count,authorships,primary_location,type'
    const MAILTO = 'evidencelens@gmail.com'

    // Call 1: Search by institution ID — gets PGIMER/GMCH papers directly
    for (const instId of TRICITY_INSTITUTION_IDS) {
      try {
        const url = `https://api.openalex.org/works?search=${encodeURIComponent(searchTerm)}&filter=institutions.id:${instId}&per_page=100&select=${SELECT}&mailto=${MAILTO}`
        const r = await fetch(url)
        if (r.ok) { const d = await r.json(); addWorks(d.results || []) }
      } catch {}
    }

    // Call 2: Broad India search filtered to country — catches any we missed
    try {
      const url = `https://api.openalex.org/works?search=${encodeURIComponent(searchTerm + ' psychiatry India')}&filter=institutions.country_code:IN&per_page=100&select=${SELECT}&mailto=${MAILTO}`
      const r = await fetch(url)
      if (r.ok) { const d = await r.json(); addWorks(d.results || []) }
    } catch {}

    // Call 3: Chandigarh explicit search
    try {
      const url = `https://api.openalex.org/works?search=${encodeURIComponent(searchTerm + ' Chandigarh')}&filter=institutions.country_code:IN&per_page=50&select=${SELECT}&mailto=${MAILTO}`
      const r = await fetch(url)
      if (r.ok) { const d = await r.json(); addWorks(d.results || []) }
    } catch {}

    // Build author clusters
    const authorMap = {}
    for (const work of allWorks) {
      if (!work.authorships) continue
      for (const auth of work.authorships) {
        const a = auth.author
        if (!a || !a.display_name) continue
        const key = a.id || a.display_name
        if (!authorMap[key]) {
          authorMap[key] = {
            id: key,
            openalexId: a.id || null,
            name: a.display_name,
            orcid: a.orcid || null,
            institutions: [],
            countries: [],
            rawAffiliations: [],
            papers: [],
            positions: {},
          }
        }
        const cluster = authorMap[key]
        if (!cluster.papers.includes(work.id)) cluster.papers.push(work.id)
        cluster.positions[work.id] = { pos: auth.author_position, corr: auth.is_corresponding }
        for (const inst of (auth.institutions || [])) {
          if (inst.display_name && !cluster.institutions.includes(inst.display_name))
            cluster.institutions.push(inst.display_name)
          if (inst.country_code && !cluster.countries.includes(inst.country_code))
            cluster.countries.push(inst.country_code)
        }
        for (const r of (auth.raw_affiliation_strings || [])) {
          if (r && !cluster.rawAffiliations.includes(r)) cluster.rawAffiliations.push(r)
        }
      }
    }

    const workMap = {}
    for (const w of allWorks) workMap[w.id] = w

    const currentYear = new Date().getFullYear()
    const profiles = []

    for (const cluster of Object.values(authorMap)) {
      // STRICT FILTER — must have tricity affiliation
      if (!isTricity(cluster)) continue

      const myWorks = cluster.papers.map(id => workMap[id]).filter(Boolean)
      if (!myWorks.length) continue

      const scoredPapers = myWorks.map(w => {
        const abstract = reconstructAbstract(w.abstract_inverted_index)
        return { ...w, sem: semanticScore(w.title, abstract, keywords) }
      })

      const top5 = [...scoredPapers].sort((a, b) => b.sem - a.sem).slice(0, 5)
      const sem = top5.reduce((a, p) => a + p.sem, 0) / Math.max(1, top5.length)

      const years = myWorks.map(w => w.publication_year).filter(Boolean)
      const mostRecent = years.length ? Math.max(...years) : 2010
      const rec = Math.max(0, 1 - (currentYear - mostRecent) / 15)

      const authScores = myWorks.map(w => {
        const p = cluster.positions[w.id]
        if (!p) return 0.3
        if (p.corr) return 0.95
        if (p.pos === 'first') return 1.0
        if (p.pos === 'last') return 0.85
        return 0.3
      })
      const auth = authScores.reduce((a, b) => a + b, 0) / authScores.length
      const depth = Math.min(1, Math.log10(myWorks.length + 1) / Math.log10(21))
      const citSum = myWorks.reduce((a, w) => a + Math.log10((w.cited_by_count || 0) + 1), 0)
      const cit = Math.min(1, citSum / 20)
      const trial = myWorks.some(w =>
        (w.title || '').toLowerCase().includes('randomized') ||
        (w.title || '').toLowerCase().includes('guideline') ||
        (w.title || '').toLowerCase().includes('trial')
      ) ? 1 : 0

      const researchScore = Math.round((sem * 0.35 + rec * 0.20 + auth * 0.15 + depth * 0.15 + cit * 0.10 + trial * 0.05) * 5 * 100) / 100
      const locScore = tricityScore(cluster)
      const finalScore = Math.min(5, Math.round((researchScore + locScore * 0.8) * 100) / 100)

      profiles.push({
        id: cluster.id,
        name: cluster.name,
        orcid: cluster.orcid,
        openalexId: cluster.openalexId,
        institution: cluster.institutions[0] || null,
        allInstitutions: cluster.institutions.slice(0, 3),
        countries: cluster.countries,
        rawAffiliation: cluster.rawAffiliations[0] || null,
        researchScore,
        locationScore: locScore,
        finalScore,
        isRegionMatch: true, // all results passed the strict tricity filter
        paperCount: myWorks.length,
        recentYear: mostRecent,
        papers: scoredPapers.sort((a, b) => b.sem - a.sem).slice(0, 5).map(w => ({
          title: w.title || 'Untitled',
          year: w.publication_year,
          journal: w.primary_location?.source?.display_name || null,
          doi: w.doi ? w.doi.replace('https://doi.org/', '') : null,
          openalexUrl: w.id,
          citations: w.cited_by_count || 0,
          relevance: Math.round(w.sem * 100),
        })),
        breakdown: { sem, rec, auth, depth, cit, trial, location: locScore },
      })
    }

    profiles.sort((a, b) => b.finalScore - a.finalScore)

    return res.status(200).json({
      profiles: profiles.slice(0, 20),
      totalPapers: allWorks.length,
      condition: matched ? matched.mesh : condition,
      region: 'Chandigarh / Panchkula / Mohali',
      retrievedAt: new Date().toISOString(),
    })

  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: err.message })
  }
}
