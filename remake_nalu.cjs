#!/usr/bin/env node
/**
 *  remake_nalu.cjs — Sinh lại toàn bộ từ điển nalei
 *  
 *  Triết lý: mềm mại, thanh lịch, lãng mạn, mượt mà, nhẹ nhàng
 *  Cảm hứng: tiếng Ý và Pháp
 *  Mục tiêu: 100% từ ≤ 2 âm tiết (lý tưởng: trung bình ~1.9)
 *
 *  Âm vị:
 *    Phụ âm:    l, m, n, r, v, s, f, y, j, w   (10)
 *    Nguyên âm: a, e, i, o, u                    (5)
 *    Nguyên âm đôi: ai, ei, ia, ie, io, oi, ua, au, eu  (9)
 *    Phụ âm cuối mềm: l, m, n, r                 (4)
 *
 *  Cấu trúc âm tiết:
 *    1. CV  — mở, du dương (vd: la, me, ni, ro)
 *    2. CVV — nguyên âm đôi, bồng bềnh (vd: lai, mei, nia)
 *    3. CVC — kết thúc mềm (vd: lal, mer, nin) — dùng vừa phải
 */

const fs = require('fs');

// ═══════════════════════════════════════════════════════════
// 1. ÂM VỊ
// ═══════════════════════════════════════════════════════════

const C = ['l', 'm', 'n', 'r', 'v', 's', 'f', 'y', 'j', 'w'];  // phụ âm
const V = ['a', 'e', 'i', 'o', 'u'];                             // nguyên âm
const D = ['ai', 'ei', 'ia', 'ie', 'io', 'oi', 'ua', 'au', 'eu']; // nguyên âm đôi
const F = ['l', 'm', 'n', 'r'];                                  // phụ âm cuối mềm

// ═══════════════════════════════════════════════════════════
// 2. SINH ÂM TIẾT
// ═══════════════════════════════════════════════════════════

function buildSyllables() {
  const set = new Set();

  // CV (ưu tiên cao nhất)
  for (const c of C)
    for (const v of V)
      set.add(c + v);

  // CVV
  for (const c of C)
    for (const d of D)
      set.add(c + d);

  // CVC (chỉ final mềm, không trùng initial)
  for (const c of C)
    for (const v of V)
      for (const f of F)
        if (f !== c)
          set.add(c + v + f);

  return [...set];
}

function sylType(s) {
  if (s.length === 2 && C.includes(s[0]) && V.includes(s[1])) return 'CV';
  if (s.length === 3 && C.includes(s[0]) && D.some(d => s.endsWith(d))) return 'CVV';
  if (s.length === 3 && C.includes(s[0]) && V.includes(s[1]) && F.includes(s[2])) return 'CVC';
  return 'OTHER';
}

/** Lấy phần nhân (vowel nucleus) của âm tiết */
function nucleus(s) {
  if (s.length === 2) return s[1];                        // CV → vowel
  if (s.length === 3 && D.some(d => s.endsWith(d))) return s.slice(1); // CVV → diphthong
  if (s.length === 3) return s[1];                        // CVC → vowel
  return '';
}

function isPleasantPair(a, b) {
  if (a === b) return false;           // không lặp âm tiết
  if (a[0] === b[0]) return false;     // không trùng phụ âm đầu
  if (nucleus(a) === nucleus(b)) return false; // không trùng nhân nguyên âm
  return true;
}

// ═══════════════════════════════════════════════════════════
// 3. SINH TỪ
// ═══════════════════════════════════════════════════════════

function generateAllWords(syllables) {
  const used = new Set();
  const words = [];

  for (const s1 of syllables) {
    for (const s2 of syllables) {
      if (!isPleasantPair(s1, s2)) continue;
      const word = s1 + s2;
      if (used.has(word)) continue;
      used.add(word);

      const t1 = sylType(s1), t2 = sylType(s2);
      let tier;
      if      (t1 === 'CV' && t2 === 'CV')   tier = 1;  // ưu tiên nhất
      else if (t1 === 'CV' && t2 === 'CVV')  tier = 2;
      else if (t1 === 'CVV' && t2 === 'CV')  tier = 2;
      else if (t1 === 'CVV' && t2 === 'CVV') tier = 3;
      else if (t1 === 'CV' && t2 === 'CVC')  tier = 3;
      else if (t1 === 'CVC' && t2 === 'CV')  tier = 3;
      else                                    tier = 4;

      // Romance score: words with l, r are more romantic
      const romance = (word.match(/[lr]/g) || []).length;
      // Open vowel score: a, o are warmer
      const openV = (word.match(/[ao]/g) || []).length;
      // Nasal/flow score: m, n add softness
      const nasal = (word.match(/[mn]/g) || []).length;

      words.push({ word, tier, romance, openV, nasal });
    }
  }

  // Sort: tier → romance (desc) → openV (desc) → nasal (desc)
  words.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    if (a.romance !== b.romance) return b.romance - a.romance;
    if (a.openV !== b.openV) return b.openV - a.openV;
    return b.nasal - a.nasal;
  });

  return words.map(w => w.word);
}

// ═══════════════════════════════════════════════════════════
// 4. ĐỌC TỪ ĐIỂN CŨ
// ═══════════════════════════════════════════════════════════

console.log('=== Đọc từ điển cũ ===');
const content = fs.readFileSync('src/naleiDictionary.tsx', 'utf-8');
const viWords = [];
const re = /'([^']+)':\s*'([a-z]+)'(?:,|$)/g;
let m;
while ((m = re.exec(content)) !== null) {
  viWords.push(m[1]);
}
console.log(`  ${viWords.length} từ tiếng Việt`);

// ═══════════════════════════════════════════════════════════
// 5. SINH & GHÉP
// ═══════════════════════════════════════════════════════════

console.log('\n=== Sinh âm tiết ===');
const syllables = buildSyllables();
console.log(`  ${syllables.length} âm tiết`);

console.log('\n=== Sinh từ 2 âm tiết ===');
const twoSylWords = generateAllWords(syllables);
console.log(`  ${twoSylWords.length} từ 2 âm tiết`);

if (twoSylWords.length < viWords.length) {
  console.error(`❌ Chỉ đủ ${twoSylWords.length} từ, cần ${viWords.length}`);
  process.exit(1);
}

// 1-syllable words for the shortest Vietnamese entries
console.log('\n=== Sinh từ 1 âm tiết (cho từ TV ngắn) ===');
const oneSylPool = syllables.filter(s => {
  // Only CV or CVV, no CVC for one-syllable words (too abrupt)
  const t = sylType(s);
  return t === 'CV' || t === 'CVV';
});
console.log(`  ${oneSylPool.length} từ 1 âm tiết khả dụng`);

// Chỉ từ TV 1 ký tự được ưu tiên 1 âm tiết nalu
const singleCharVi = viWords.filter(w => w.length === 1);
const restVi = viWords.filter(w => w.length > 1);
console.log(`  TV 1 ký tự: ${singleCharVi.length} từ`);
console.log(`  TV >1 ký tự: ${restVi.length} từ`);

// Verify we have enough 2-syl words for the rest
if (twoSylWords.length < restVi.length) {
  console.error(`❌ Không đủ từ 2 âm tiết cho ${restVi.length} từ TV`);
  process.exit(1);
}

// Assign: 1-syl for single-char, 2-syl for rest
const naluWords = [];
const oneSylAssigned = oneSylPool.slice(0, singleCharVi.length);
const twoSylAssigned = twoSylWords.slice(0, restVi.length);

const dict = {};
for (let i = 0; i < singleCharVi.length; i++) {
  dict[singleCharVi[i]] = oneSylAssigned[i];
}
for (let i = 0; i < restVi.length; i++) {
  dict[restVi[i]] = twoSylAssigned[i];
}

// ═══════════════════════════════════════════════════════════
// 6. THỐNG KÊ
// ═══════════════════════════════════════════════════════════

function countSyllables(word) {
  let i = 0, c = 0;
  while (i < word.length) {
    if (i + 1 < word.length && D.some(d => word.startsWith(d, i))) { c++; i += 2; }
    else if (V.includes(word[i])) { c++; i++; }
    else i++;
  }
  return c;
}

const sylDist = {};
let totalSyl = 0;
for (const w of Object.values(dict)) {
  const s = countSyllables(w);
  sylDist[s] = (sylDist[s] || 0) + 1;
  totalSyl += s;
}
const avg = totalSyl / Object.keys(dict).length;

console.log('\n📊 === PHÂN BỐ ÂM TIẾT ===');
for (const s of Object.keys(sylDist).sort((a,b) => a-b)) {
  const pct = (sylDist[s] / Object.keys(dict).length * 100).toFixed(1);
  console.log(`  ${s} âm tiết: ${sylDist[s]} (${pct}%)`);
}
console.log(`  Trung bình: ${avg.toFixed(2)} âm tiết/từ`);

// ═══════════════════════════════════════════════════════════
// 7. XUẤT FILE
// ═══════════════════════════════════════════════════════════

const keys = Object.keys(dict).sort((a, b) => a.localeCompare(b, 'vi'));

let output = `// nalei — Ánh xạ từ vựng theo quy tắc ngữ âm
//
// Quy tắc:
//   - Phụ âm mềm: l, m, n, r, v, s, f, y, j, w
//   - Nguyên âm: a, e, i, o, u
//   - Nguyên âm đôi: ai, ei, ia, ie, io, oi, ua, au, eu
//   - Phụ âm cuối (mềm): l, m, n, r
//   - Cấu trúc ưu tiên: CV · CVV · CVC (final mềm)
//   - Ràng buộc thẩm mỹ: không lặp âm tiết, đa dạng phụ âm/nhóm cấu âm
//   - Âm hưởng: mềm mại, thanh lịch, lãng mạn (cảm hứng Ý-Pháp)
//
// Tổng số mapping: ${keys.length}
// Sinh ngày: ${new Date().toISOString().slice(0, 19).replace('T', ' ')}
// Phân bố âm tiết: ${Object.entries(sylDist).sort((a,b) => a[0]-b[0]).map(([s,c]) => s + ' âm tiết: ' + c + ' (' + (c/keys.length*100).toFixed(1) + '%)').join('; ')}
// Trung bình: ${avg.toFixed(2)} âm tiết/từ

export const naleiDictionary: Record<string, string> = {\n`;

for (const key of keys) {
  output += `  '${key}': '${dict[key]}',\n`;
}

output += '}\n';

fs.writeFileSync('src/naleiDictionary.tsx', output, 'utf-8');
console.log('\n✅ Đã ghi src/naleiDictionary.tsx');
console.log(`📁 ${keys.length} mục từ — ${Object.keys(sylDist).length} cấp âm tiết`);
