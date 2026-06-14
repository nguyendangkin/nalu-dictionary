import { useState, useMemo, useEffect, useRef } from 'react'
import { naluDictionary } from './naluDictionary'
import './App.css'

type FilterMode = 'all' | 'vi' | 'new'

interface Entry {
  vi: string
  newWord: string
}

const entries: Entry[] = Object.entries(naluDictionary)
  .map(([vi, newWord]) => ({ vi, newWord }))
  .sort((a, b) => a.vi.localeCompare(b.vi, 'vi'))

const dictLower = new Map<string, string>()
for (const [vi, nw] of Object.entries(naluDictionary)) {
  dictLower.set(vi.toLowerCase(), nw)
}

const LETTER_GROUPS = '#abcdefghijklmnopqrstuvwxyz'.split('')

function speak(text: string) {
  if (!text.trim()) return
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'fr-FR'
  u.rate = 0.9
  // pick a French voice (prefer female)
  const voices = speechSynthesis.getVoices()
  const fv = voices.find(v => v.lang.startsWith('fr') && /female|marie|julie|audrey|samantha/i.test(v.name))
       || voices.find(v => v.lang.startsWith('fr'))
  if (fv) u.voice = fv
  // if voices not loaded yet, pick voice on voiceschanged
  if (voices.length === 0) {
    speechSynthesis.addEventListener('voiceschanged', () => {
      const vs = speechSynthesis.getVoices()
      const v = vs.find(v => v.lang.startsWith('fr') && /female|marie|julie|audrey|samantha/i.test(v.name))
            || vs.find(v => v.lang.startsWith('fr'))
      if (v) u.voice = v
    }, { once: true })
  }
  speechSynthesis.speak(u)
}

interface PhraseWord {
  /** The full original token (e.g. "hiểu," or "Nỗi") */
  original: string
  /** Word portion after removing punctuation (e.g. "hiểu") */
  clean: string
  /** Trailing punctuation (e.g. "," or ".") */
  punct: string
  /** Translated word before applying capitalization & punctuation */
  translated: string | null
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1)
}

function splitPunct(word: string): [string, string] {
  const m = word.match(/^([a-zA-ZàáảãạâầấẩẫậăằắẳẵặèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđÀÁẢÃẠÂẦẤẨẪẬĂẰẮẲẴẶÈÉẺẼẸÊỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦŨỤƯỪỨỬỮỰỲÝỶỸỴĐ]+)([(),.!?;:'"«»“”…\-–—]*)$/)
  if (m) return [m[1], m[2]]
  return [word, '']
}

function translatePhrase(text: string): { original: string; tokens: PhraseWord[] } {
  const tokens = text
    .split(/\s+/)
    .filter(w => w.length > 0)
    .map(word => {
      const [clean, punct] = splitPunct(word)
      const lower = clean.toLowerCase()
      const translated = dictLower.get(lower) ?? null
      return { original: word, clean, punct, translated }
    })
  return { original: text, tokens }
}

function App() {
  const [search, setSearch] = useState('')
  const [filterMode, setFilterMode] = useState<FilterMode>('all')
  const [page, setPage] = useState(1)
  const inputRef = useRef<HTMLInputElement>(null)
  const perPage = 60

  const isPhrase = search.trim().includes(' ')

  const phraseResult = useMemo(() => {
    if (!isPhrase || !search.trim()) return null
    return translatePhrase(search.trim())
  }, [search, isPhrase])

  const phraseTokens = phraseResult?.tokens ?? []

  const filtered = useMemo(() => {
    if (isPhrase || !search.trim()) return entries
    const q = search.toLowerCase().trim()

    const matchVi = (vi: string) => vi.startsWith(q)
    const matchNw = (nw: string) => nw.includes(q)

    const results = entries.filter(e => {
      if (filterMode === 'vi') return matchVi(e.vi.toLowerCase())
      if (filterMode === 'new') return matchNw(e.newWord)
      return matchVi(e.vi.toLowerCase()) || matchNw(e.newWord)
    })

    return results.sort((a, b) => {
      const aVI = a.vi.toLowerCase()
      const bVI = b.vi.toLowerCase()
      const aNW = a.newWord
      const bNW = b.newWord

      const rank = (vi: string, nw: string): [number, number] => {
        const matchVI = vi.startsWith(q)
        const matchNW = nw.includes(q)

        let level = 99
        if (filterMode === 'vi' || filterMode === 'all') {
          if (vi === q) level = 0
          else if (matchVI) level = 1
        }
        if (filterMode === 'new' || filterMode === 'all') {
          if (nw === q) level = Math.min(level, 0)
          else if (nw.startsWith(q)) level = Math.min(level, 1)
          else if (matchNW) level = Math.min(level, 2)
        }
        const source = matchVI ? 0 : 1
        return [level, source]
      }

      const [la, sa] = rank(aVI, aNW)
      const [lb, sb] = rank(bVI, bNW)

      if (la !== lb) return la - lb
      if (sa !== sb) return sa - sb
      return a.vi.localeCompare(b.vi, 'vi')
    })
  }, [search, filterMode, isPhrase])

  const totalPages = Math.ceil(filtered.length / perPage)
  const paged = filtered.slice((page - 1) * perPage, page * perPage)

  useEffect(() => { setPage(1) }, [search, filterMode])

  const jumpToLetter = (letter: string) => {
    setFilterMode('vi')
    if (letter === '#') {
      const idx = entries.findIndex(e => /^[^a-zA-Z]/.test(e.vi))
      if (idx >= 0) {
        setSearch(entries[idx].vi.slice(0, 3))
        return
      }
    }
    const found = entries.find(e => e.vi.toLowerCase().startsWith(letter))
    if (found) {
      setSearch(letter)
    }
  }

  const handleInput = (val: string) => {
    setSearch(val)
    if (val.trim().includes(' ')) {
      setFilterMode('all')
    }
  }

  const missingCount = phraseResult ? phraseResult.tokens.filter(w => !w.translated).length : 0

  return (
    <div className="app">
      {/* ─── Header ─────────────────────────────── */}
      <header className="app-header">
        <div>
          <h1 className="app-title">nalu</h1>
          <p className="app-subtitle">
            nàng nói một thứ tiếng khác, để tránh người hầu gần bên hiểu
          </p>
        </div>
      </header>

      {/* ─── Pull Quote ──────────────────────────── */}
      <aside className="pull-quote">
        <p>
          Nàng khẽ nghiêng người, giọng bỗng đổi sang một thứ tiếng lạ — mềm mại, thì thầm, không một người hầu nào trong phòng hiểu nổi. Ông ta ngước nhìn nàng, thoáng ngỡ ngàng, rồi khẽ cười.
        </p>
        <p className="pull-quote-nalu">
          <q>Reli nifoi yamai mijau reuja verio?</q>
          <span className="pull-quote-vi">(Anh ấy trông đẹp quá nhỉ)</span>
        </p>
        <p>
          Ông ta không trả lời bằng lời, chỉ đưa tay rót thêm trà vào tách nàng, mắt vẫn không rời. Một bí mật nhỏ vừa được sinh ra giữa hai người — ngay trước mặt bao người, mà chẳng ai hay.
        </p>
      </aside>

      {/* ─── Search ──────────────────────────────── */}
      <div className="search-section">
        <div className="search-bar">
          <input
            ref={inputRef}
            type="text"
            placeholder="Tìm từ hoặc nhập cụm từ để dịch…"
            value={search}
            onChange={e => handleInput(e.target.value)}
            autoFocus
          />
          {search && (
            <button className="search-clear" onClick={() => setSearch('')}>
              ✕
            </button>
          )}
        </div>
        {!isPhrase && (
          <div className="filter-tabs">
            {(['all', 'vi', 'new'] as const).map(mode => (
              <button
                key={mode}
                className={`filter-tab ${filterMode === mode ? 'active' : ''}`}
                onClick={() => setFilterMode(mode)}
              >
                {mode === 'all' ? 'Tất cả' : mode === 'vi' ? 'Từ gốc' : 'Từ mới'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ─── Phrase Translation ──────────────────── */}
      {phraseResult && (
        <section className="phrase-panel">
          <div className="phrase-header">
            <span className="phrase-label">Chuyển ngữ</span>
            <button className="speak-btn" onClick={() => speak(
              phraseTokens.map(w => w.translated ?? w.clean).filter(Boolean).join(' ')
            )}>
              ▶
            </button>
          </div>

          <div className="phrase-block">
            <div className="phrase-line phrase-source">
              {phraseTokens.map((w, i) => (
                <span key={i} className="pt-src">
                  {i > 0 && ' '}{w.original}
                </span>
              ))}
            </div>

            <div className="phrase-line phrase-target">
              {phraseTokens.map((w, i) => {
                const isCap = /^[A-ZÀÁẢÃẠÂẦẤẨẪẬĂẰẮẲẴẶÈÉẺẼẸÊỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦŨỤƯỪỨỬỮỰỲÝỶỸỴĐ]/.test(w.original)
                return (
                  <span key={i} className="pt-tgt">
                    {i > 0 && ' '}
                    {w.translated ? (
                      <span className="pt-found">
                        {(isCap ? capitalize(w.translated) : w.translated)}{w.punct}
                      </span>
                    ) : (
                      <span className="pt-miss">{w.original}</span>
                    )}
                  </span>
                )
              })}
            </div>
          </div>

          {missingCount > 0 && (
            <div className="phrase-footer">
              <span className="phrase-note">
                {missingCount} từ chưa có trong từ điển
              </span>
            </div>
          )}
        </section>
      )}

      {/* ─── Dictionary view ─────────────────────── */}
      {!isPhrase && (
        <>
          <div className="stats-bar">
            <div className="stat">
              <span className="stat-num">{entries.length.toLocaleString()}</span>
              <span className="stat-label">từ</span>
            </div>
            {search && (
              <div className="stat">
                <span className="stat-num">{filtered.length.toLocaleString()}</span>
                <span className="stat-label">kết quả</span>
              </div>
            )}
          </div>

          <nav className="alpha-nav">
            {LETTER_GROUPS.map(ch => (
              <button key={ch} className="alpha-btn" onClick={() => jumpToLetter(ch)}>
                {ch === '#' ? '#' : ch.toUpperCase()}
              </button>
            ))}
          </nav>

          <main className="dictionary">
            {paged.length === 0 ? (
              <div className="empty-state">
                <p>Không tìm thấy từ "{search}"</p>
              </div>
            ) : (
              paged.map(entry => (
                <div className="entry" key={entry.vi}>
                  <span className="entry-vi">{entry.vi}</span>
                  <span className="entry-arrow">→</span>
                  <span className="entry-new">{entry.newWord}</span>
                  <button className="speak-btn-sm" onClick={() => speak(entry.newWord)}>▶</button>
                </div>
              ))
            )}
          </main>

          {totalPages > 1 && (
            <div className="pagination">
              <button
                className="page-btn"
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
              >
                ‹
              </button>
              <span className="page-info">{page} / {totalPages}</span>
              <button
                className="page-btn"
                disabled={page >= totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              >
                ›
              </button>
            </div>
          )}
        </>
      )}

      {/* ─── Footer ──────────────────────────────── */}
      <footer className="app-footer">
        <p>{entries.length.toLocaleString()} mục từ</p>
      </footer>
    </div>
  )
}

export default App
