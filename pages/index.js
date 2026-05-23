import { useState } from 'react'

const PSYCHIATRY_CONDITIONS = [
  'Depression', 'Anxiety', 'Schizophrenia', 'Bipolar Disorder',
  'OCD', 'ADHD', 'PTSD', 'Autism', 'Addiction', 'Suicide Prevention',
  'Dementia', 'Eating Disorders'
]

const REGIONS = ['Delhi / NCR', 'Chandigarh', 'Punjab', 'Haryana', 'Himachal']

export default function Home() {
  const [condition, setCondition] = useState('')
  const [region, setRegion] = useState('')
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState({})

  async function search() {
    if (!condition.trim()) return
    setLoading(true)
    setError('')
    setResults(null)
    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ condition, region }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setResults(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  function toggle(id) {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <div style={{ fontFamily: '-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif', background: '#0a0f1a', minHeight: '100vh', color: '#e2e8f0' }}>

      {/* Disclaimer */}
      <div style={{ background: '#1a0a00', borderBottom: '1px solid #78350f33', padding: '6px 16px', textAlign: 'center', fontSize: 11, color: '#d97706' }}>
        ⚠ EvidenceLens surfaces research-signal profiles from academic databases. <strong>Not medical advice.</strong> Research activity ≠ clinical quality. Always verify directly with the institution.
      </div>

      {/* Nav */}
      <nav style={{ background: '#080d18', borderBottom: '1px solid #1e2d45', padding: '0 24px', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ color: '#14b8a6', fontWeight: 700, fontSize: 18, letterSpacing: '.5px' }}>
          Evidence<span style={{ color: '#64748b', fontWeight: 400 }}>Lens</span>
          <span style={{ marginLeft: 10, fontSize: 11, color: '#0f766e', background: '#042f2a', border: '1px solid #0f766e', borderRadius: 20, padding: '2px 10px' }}>Psychiatry · North India</span>
        </div>
        <div style={{ fontSize: 11, color: '#475569' }}>Powered by OpenAlex · PubMed</div>
      </nav>

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '48px 24px' }}>

        {/* Hero */}
        {!results && !loading && (
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <h1 style={{ fontSize: 32, fontWeight: 700, color: '#f1f5f9', lineHeight: 1.3, marginBottom: 12 }}>
              Find psychiatrists who actually<br />research your condition
            </h1>
            <p style={{ color: '#94a3b8', fontSize: 14, lineHeight: 1.7, maxWidth: 520, margin: '0 auto' }}>
              Real academic signals from OpenAlex and PubMed. The researcher with the most impactful published work on your condition, closest to you, ranked first.
            </p>
          </div>
        )}

        {/* Search box */}
        <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 16, padding: 24, marginBottom: 24 }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 8 }}>Condition</label>
            <input
              value={condition}
              onChange={e => setCondition(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && search()}
              placeholder="e.g. depression, schizophrenia, ADHD, OCD..."
              style={{ width: '100%', background: '#1a2236', border: '1.5px solid #1e2d45', borderRadius: 10, padding: '12px 16px', fontSize: 15, color: '#e2e8f0', outline: 'none', fontFamily: 'inherit' }}
            />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
              {PSYCHIATRY_CONDITIONS.map(c => (
                <button key={c} onClick={() => setCondition(c)}
                  style={{ background: condition === c ? '#042f2a' : '#1a2236', border: `1px solid ${condition === c ? '#0f766e' : '#1e2d45'}`, borderRadius: 20, padding: '4px 12px', fontSize: 11, color: condition === c ? '#14b8a6' : '#94a3b8', cursor: 'pointer' }}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 8 }}>Region (optional — narrows to local researchers)</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {REGIONS.map(r => (
                <button key={r} onClick={() => setRegion(region === r ? '' : r)}
                  style={{ background: region === r ? '#042f2a' : '#1a2236', border: `1.5px solid ${region === r ? '#0f766e' : '#1e2d45'}`, borderRadius: 20, padding: '7px 16px', fontSize: 12, color: region === r ? '#14b8a6' : '#94a3b8', cursor: 'pointer' }}>
                  {r}
                </button>
              ))}
            </div>
          </div>

          <button onClick={search} disabled={!condition.trim() || loading}
            style={{ width: '100%', background: '#0f766e', color: '#fff', border: 'none', borderRadius: 10, padding: '13px 0', fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: !condition.trim() || loading ? 0.5 : 1 }}>
            {loading ? 'Searching real academic databases…' : 'Search →'}
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#14b8a6' }}>
            <div style={{ fontSize: 13, fontFamily: 'monospace', marginBottom: 8 }}>Querying OpenAlex · Scoring researchers · Ranking by region…</div>
            <div style={{ fontSize: 11, color: '#475569' }}>This takes 5–15 seconds. Fetching real data.</div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ background: '#130000', border: '1px solid #7f1d1d44', borderRadius: 10, padding: '12px 16px', color: '#ef4444', fontSize: 13, marginBottom: 16 }}>
            Error: {error}
          </div>
        )}

        {/* Results */}
        {results && (
          <div>
            {/* Summary */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 20 }}>
              {[
                { n: results.totalPapers, l: 'Papers retrieved' },
                { n: results.profiles.length, l: 'Researchers found' },
                { n: results.profiles.filter(p => p.isRegionMatch).length, l: 'Region matched' },
                { n: results.profiles.filter(p => p.orcid).length, l: 'ORCID verified' },
              ].map(s => (
                <div key={s.l} style={{ background: '#1a2236', border: '1px solid #1e2d45', borderRadius: 10, padding: 14, textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 600, color: '#14b8a6' }}>{s.n}</div>
                  <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>{s.l}</div>
                </div>
              ))}
            </div>

            <p style={{ fontSize: 11, color: '#475569', marginBottom: 16 }}>
              Condition: <strong style={{ color: '#94a3b8' }}>{results.condition}</strong> ·
              Region: <strong style={{ color: '#94a3b8' }}>{results.region || 'All India'}</strong> ·
              Ranked by research alignment + regional proximity · Not a clinical ranking
            </p>

            {results.profiles.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#475569' }}>
                <p style={{ fontSize: 15, color: '#94a3b8', marginBottom: 8 }}>No profiles found for this search.</p>
                <p style={{ fontSize: 13 }}>Try removing the region filter, or search a related condition.</p>
              </div>
            )}

            {results.profiles.map((p, i) => (
              <div key={p.id} style={{ background: '#111827', border: `1px solid ${p.isRegionMatch ? '#0f766e44' : '#1e2d45'}`, borderRadius: 18, padding: 22, marginBottom: 16, position: 'relative', borderLeft: `4px solid ${i === 0 ? '#14b8a6' : i === 1 ? '#8b5cf6' : '#1e3a5f'}` }}>

                {i < 3 && (
                  <div style={{ position: 'absolute', top: 16, right: 16, background: i === 0 ? '#042f2a' : '#1a1040', border: `1px solid ${i === 0 ? '#0f766e' : '#4c1d95'}`, color: i === 0 ? '#14b8a6' : '#8b5cf6', fontSize: 10, padding: '3px 8px', borderRadius: 6, fontWeight: 600 }}>
                    #{i + 1} match
                  </div>
                )}

                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                  <div style={{ flex: 1, paddingRight: 60 }}>
                    <div style={{ fontSize: 17, fontWeight: 700, color: '#f1f5f9', marginBottom: 3 }}>{p.name}</div>
                    {p.institution && <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 3 }}>{p.institution}</div>}
                    {p.rawAffiliation && <div style={{ fontSize: 10, color: '#475569', marginTop: 2, fontStyle: 'italic' }}>"{p.rawAffiliation.slice(0, 90)}{p.rawAffiliation.length > 90 ? '…' : ''}"</div>}

                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                      {p.isRegionMatch && <span style={{ fontSize: 10, background: '#042f2a', border: '1px solid #0f766e55', color: '#14b8a6', borderRadius: 4, padding: '2px 7px' }}>✓ Region match</span>}
                      {p.orcid && <a href={`https://orcid.org/${p.orcid.replace('https://orcid.org/', '')}`} target="_blank" rel="noopener" style={{ fontSize: 10, border: '1px solid #0f766e55', color: '#14b8a6', borderRadius: 4, padding: '2px 7px' }}>ORCID ↗</a>}
                      {p.openalexId && <a href={p.openalexId} target="_blank" rel="noopener" style={{ fontSize: 10, border: '1px solid #1e2d45', color: '#94a3b8', borderRadius: 4, padding: '2px 7px' }}>OpenAlex ↗</a>}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 34, fontWeight: 700, color: '#14b8a6', lineHeight: 1 }}>{p.finalScore.toFixed(1)}</div>
                    <div style={{ fontSize: 9, color: '#64748b', marginTop: 2 }}>/ 5.0 total score</div>
                    <div style={{ fontSize: 9, color: '#475569' }}>research {p.researchScore.toFixed(1)} + location +{p.locationScore.toFixed(1)}</div>
                  </div>
                </div>

                {/* Score bar */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#475569', marginBottom: 3 }}>
                    <span>Research alignment</span><span>{p.researchScore.toFixed(2)} / 5.0</span>
                  </div>
                  <div style={{ height: 5, background: '#1e2d45', borderRadius: 3 }}>
                    <div style={{ height: 5, background: '#14b8a6', borderRadius: 3, width: `${(p.researchScore / 5) * 100}%`, transition: 'width 1s ease' }} />
                  </div>
                </div>

                {/* Papers */}
                <div style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 8 }}>
                  Verified publications ({p.paperCount}) · showing top {p.papers.length}
                </div>
                {p.papers.map((pub, j) => (
                  <div key={j} style={{ borderLeft: '2px solid #1e2d45', paddingLeft: 12, marginBottom: 8 }}>
                    <div style={{ fontSize: 11, color: '#e2e8f0', lineHeight: 1.4 }}>{pub.title}</div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                      {pub.year && <span style={{ fontSize: 10, color: '#475569' }}>{pub.year}</span>}
                      {pub.journal && <span style={{ fontSize: 10, color: '#475569', fontStyle: 'italic', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pub.journal}</span>}
                      {pub.doi && <a href={`https://doi.org/${pub.doi}`} target="_blank" rel="noopener" style={{ fontSize: 10, color: '#14b8a6' }}>DOI ↗</a>}
                      {!pub.doi && pub.openalexUrl && <a href={pub.openalexUrl} target="_blank" rel="noopener" style={{ fontSize: 10, color: '#14b8a6' }}>OpenAlex ↗</a>}
                      {pub.citations > 0 && <span style={{ fontSize: 10, color: '#475569' }}>{pub.citations} citations</span>}
                      {pub.relevance > 70 && <span style={{ fontSize: 9, background: '#042f2a', border: '1px solid #0f766e44', color: '#14b8a6', borderRadius: 4, padding: '1px 5px' }}>High relevance</span>}
                    </div>
                  </div>
                ))}

                {/* Score breakdown toggle */}
                <div style={{ marginTop: 10 }}>
                  <button onClick={() => toggle(p.id)} style={{ fontSize: 11, color: '#475569', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                    {expanded[p.id] ? 'Hide score breakdown ↑' : 'Show score breakdown ↓'}
                  </button>
                  {expanded[p.id] && (
                    <div style={{ background: '#1a2236', borderRadius: 10, padding: 14, marginTop: 8 }}>
                      {[
                        ['Semantic relevance (35%)', p.breakdown.sem],
                        ['Recency (20%)', p.breakdown.rec],
                        ['Authorship weight (15%)', p.breakdown.auth],
                        ['Publication depth (15%)', p.breakdown.depth],
                        ['Citation signal (10%)', p.breakdown.cit],
                        ['Trial/guideline signal (5%)', p.breakdown.trial],
                        ['Location match (bonus)', p.breakdown.location],
                      ].map(([label, val]) => (
                        <div key={label} style={{ marginBottom: 8 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#94a3b8', marginBottom: 2 }}>
                            <span>{label}</span><span style={{ fontFamily: 'monospace' }}>{val.toFixed(3)}</span>
                          </div>
                          <div style={{ height: 3, background: '#1e2d45', borderRadius: 2 }}>
                            <div style={{ height: 3, background: '#14b8a6', borderRadius: 2, width: `${val * 100}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Summary */}
                <div style={{ fontSize: 11, color: '#64748b', fontStyle: 'italic', borderTop: '1px solid #1e2d45', paddingTop: 10, marginTop: 10, lineHeight: 1.6 }}>
                  This profile has condition-specific academic activity based on {p.paperCount} verified publication{p.paperCount !== 1 ? 's' : ''} from OpenAlex.
                  {p.isRegionMatch ? ' Regional affiliation confirmed via publication records.' : ''}
                  {' '}Clinician status and clinical availability require direct verification with the institution.
                  <strong style={{ color: '#f59e0b' }}> Not a clinical recommendation.</strong>
                </div>
              </div>
            ))}

            <div style={{ marginTop: 24, borderTop: '1px solid #1e2d45', paddingTop: 16, fontSize: 10, color: '#475569', lineHeight: 2 }}>
              <p>Source: OpenAlex API · filter: institutions.country_code:IN · Retrieved: {new Date(results.retrievedAt).toLocaleString()}</p>
              <p>Location match: raw affiliation strings scored against region keyword list</p>
              <p>• Clinician status not verified from medical council records</p>
              <p>• Clinical availability requires direct verification with institution</p>
              <p>• This is not medical advice. Not a clinical recommendation.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
