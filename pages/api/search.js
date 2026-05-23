export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { condition, region } = req.body
  if (!condition) return res.status(400).json({ error: 'No condition provided' })

  const REGION_KEYWORDS = {
    chandigarh: ['chandigarh', 'pgimer', 'pgi', 'post graduate institute', 'gmch'],
    delhi: ['delhi', 'new delhi', 'aiims', 'safdarjung', 'sir ganga ram', 'lnjp', 'gb pant'],
    punjab: ['punjab', 'ludhiana', 'amritsar', 'dayanand', 'cmc ludhiana'],
    haryana: ['haryana', 'rohtak', 'pgims', 'gurgaon', 'gurugram', 'faridabad'],
    himachal: ['himachal', 'shimla', 'igmc', 'tanda'],
  }

  const PSYCHIATRY_CONDITIONS = {
    depression: { mesh: 'depressive disorder', keywords: ['depression', 'depressive', 'antidepressant', 'MDD', 'major depressive'] },
    anxiety: { mesh: 'anxiety disorders', keywords: ['anxiety', 'GAD', 'panic disorder', 'generalised anxiety'] },
    schizophrenia: { mesh: 'schizophrenia', keywords: ['schizophrenia', 'psychosis', 'antipsychotic', 'schizophrenic'] },
    bipolar: { mesh: 'bipolar disorder', keywords: ['bipolar', 'mania', 'manic', 'mood disorder'] },
    ocd: { mesh: 'obsessive-compulsive disorder', keywords: ['OCD', 'obsessive compulsive', 'obsession', 'compulsion'] },
    adhd: { mesh: 'attention deficit disorder with hyperactivity', keywords: ['ADHD', 'attention deficit', 'hyperactivity', 'hyperkinetic'] },
    ptsd: { mesh: 'stress disorders post-traumatic', keywords: ['PTSD', 'post traumatic', 'trauma', 'post-traumatic stress'] },
    autism: { mesh: 'autistic disorder', keywords: ['autism', 'ASD', 'autistic', 'autism spectrum'] },
    addiction: { mesh: 'substance-related disorders', keywords: ['addiction', 'substance use', 'alcohol dependence', 'drug abuse', 'de-addiction'] },
    suicide: { mesh: 'suicidal ideation', keywords: ['suicide', 'suicidal', 'self harm', 'deliberate self harm'] },
    dementia: { mesh: 'dementia', keywords: ['dementia', 'alzheimer', 'cognitive decline', 'memory disorder'] },
    eating: { mesh: 'feeding and eating disorders', keywords: ['eating disorder', 'anorexia', 'bulimia', 'binge eating'] },
  }

  // Match condition
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

  // Match region
  const regionLower = (region || '').toLowerCase()
  let regionKey = null
  for (const [key, terms] of Object.entries(REGION_KEYWORDS)) {
    if (terms.some(t => regionLower.includes(t)) || regionLower.includes(key)) {
      regionKey = key
      break
    }
  }
  const regionTerms = regionKey ? REGION_KEYWORDS[regionKey] : []

  try {
    // Call OpenAlex — server side, no CORS issue
    const query = `${searchTerm} India psychiatry`
    const url = `https://api.openalex.org/works?search=${encodeURIComponent(query)}&filter=institutions.country_code:IN&per_page=50&select=id,title,abstract_inverted_index,publication_year,doi,cited_by_count,authorships,primary_location,type&mailto=evidencelens@gmail.com`

    const response = await fetch(url)
    if (!response.ok) throw new Error('OpenAlex fetch failed')
    const data = await response.json()
    const works = data.results || []

    // Cluster by author
    const authorMap = {}
    for (const work of works) {
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
        const raw = auth.raw_affiliation_strings || []
        for (const r of raw) {
          if (r && !cluster.rawAffiliations.includes(r)) cluster.rawAffiliations.push(r)
        }
      }
    }

    // Build work map
    const workMap = {}
    for (const w of works) workMap[w.id] = w

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

    function locationScore(cluster) {
      if (!regionKey) return 0.5
      const allText = [...cluster.rawAffiliations, ...cluster.institutions].join(' ').toLowerCase()
      const hits = regionTerms.filter(t => allText.includes(t)).length
      if (hits >= 2) return 1.0
      if (hits === 1) return 0.7
      if (cluster.countries.includes('IN')) return 0.2
      return 0.0
    }

    const currentYear = new Date().getFullYear()
    const profiles = []

    for (const cluster of Object.values(authorMap)) {
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
        (w.title || '').toLowerCase().includes('trial') ||
        (w.title || '').toLowerCase().includes('guideline')
      ) ? 1 : 0

      const researchScore = Math.round((sem * 0.35 + rec * 0.20 + auth * 0.15 + depth * 0.15 + cit * 0.10 + trial * 0.05) * 5 * 100) / 100
      const locScore = locationScore(cluster)
      const finalScore = Math.min(5, Math.round((researchScore + locScore * 0.8) * 100) / 100)

      if (researchScore < 0.2) continue

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
        isRegionMatch: locScore >= 0.6,
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
      profiles: profiles.slice(0, 15),
      totalPapers: works.length,
      condition: matched ? matched.mesh : condition,
      region: regionKey,
      retrievedAt: new Date().toISOString(),
    })

  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: err.message })
  }
}
