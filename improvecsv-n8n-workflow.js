// n8n Code node (JavaScript) – transforms your rows
// Input: items[] where item.json is one CSV row
// Output: items[] with transformed fields

function norm(s) {
  if (typeof s !== 'string') return '';
  return s.normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();
}

const BRANDS_TO_REMOVE = new Set([
  'Klimas Sp','Top Marken','EFF EFF','E.u.r.o Tec GmbH','Förch','Meisterling','Beurskens',
  'Fenster-Hammer','EVVA','Hanno','Heicko','K-A-L-M','DIAGER','Medid','Zaunrebell',
  'FENSTER-HAMMER','SCHRAUBEN-HAMMER',
].map(norm));

const CATEGORIES_TO_REMOVE = new Set([
  'SCREWREBEL','WERA','Klimas Sp','Top Marken','FAMAG','INTRA-TEC','Pica','Burg Wächter',
  'ISEO','BEVER','EFF EFF','ABUS','INDEX',
].map(norm));

// Try to parse string representations of lists (JSON or Python style)
function parseListLike(raw) {
  const queue = [String(raw)];
  const attempts = [];
  const seen = new Set();

  while (queue.length) {
    const current = queue.shift();
    if (typeof current !== 'string') continue;
    const trimmed = current.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);

    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      if (!attempts.includes(trimmed)) attempts.push(trimmed);
    }

    // unwrap outer quotes and enqueue inner content for further processing
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
      const inner = trimmed.slice(1, -1);
      if (inner && !seen.has(inner)) queue.push(inner);
    }

    if (trimmed.includes('\\"')) queue.push(trimmed.replace(/\\"/g, '"'));
    if (trimmed.includes("\\'")) queue.push(trimmed.replace(/\\'/g, "'"));
  }

  for (const attempt of attempts) {
    try {
      const parsed = JSON.parse(attempt);
      if (Array.isArray(parsed)) return parsed;
    } catch { /* try next approach */ }
  }

  for (const attempt of attempts) {
    const parsed = parsePythonStyleStringList(attempt);
    if (parsed) return parsed;
  }

  return null;
}

function parsePythonStyleStringList(str) {
  const s = str.trim();
  if (!s.startsWith('[') || !s.endsWith(']')) return null;

  const result = [];
  let i = 1;
  const end = s.length - 1;

  while (i < end) {
    // Skip whitespace and commas between entries
    while (i < end && /[\s,]/.test(s[i])) i++;
    if (i >= end) break;

    const quote = s[i];
    if (quote !== '"' && quote !== "'") return null;
    i++;

    let value = '';
    let closed = false;

    while (i < end) {
      const ch = s[i];

      if (ch === '\\') {
        if (i + 1 >= end) return null;
        const esc = s[i + 1];
        if (esc === 'u') {
          const hex = s.slice(i + 2, i + 6);
          if (hex.length < 4 || /[^0-9a-fA-F]/.test(hex)) return null;
          value += String.fromCharCode(parseInt(hex, 16));
          i += 6;
          continue;
        }

        const escapes = { '\\': '\\', '"': '"', "'": "'", n: '\n', r: '\r', t: '\t' };
        value += escapes.hasOwnProperty(esc) ? escapes[esc] : esc;
        i += 2;
        continue;
      }

      if (ch === quote) {
        closed = true;
        i++;
        break;
      }

      value += ch;
      i++;
    }

    if (!closed) return null;
    result.push(value);

    // skip trailing whitespace after element
    while (i < end && /\s/.test(s[i])) i++;

    if (i < end) {
      if (s[i] === ',') {
        i++;
      } else {
        return null;
      }
    }
  }

  return result;
}

function splitCategoryEntries(catStr) {
  return catStr.split(/\s*%%\s*/).map(s => s.trim()).filter(Boolean);
}

// Parse '["Zubehör","Zubehör;Bits","Top Marken"]' to "Zubehör %% Zubehör > Bits"
function parseCategoryCell(cell) {
  if (cell == null || String(cell).trim() === '') return '';
  const raw = String(cell).trim();

  const parsedList = parseListLike(raw);
  if (parsedList) {
    const out = parsedList
      .map(x => String(x).trim())
      .filter(Boolean)
      .map(entry => entry.includes(';')
        ? entry.split(';').map(s => s.trim()).filter(Boolean).join(' > ')
        : entry);
    return out.join(' %% ');
  }

  // fallback: single string with semicolons
  if (raw.includes(';')) {
    return raw
      .split(';')
      .map(s => s.trim())
      .filter(Boolean)
      .join(' > ');
  }

  if (raw === '[]' || raw === '[""]' || raw === "['']") return '';
  return raw;
}

function cleanDuplicateFlatCategories(catStr) {
  if (!catStr) return catStr;
  const cats = splitCategoryEntries(catStr);
  const trees = cats.filter(c => c.includes('>'));
  const roots = new Set(trees.map(tr => tr.split('>')[0].trim()));
  return cats.filter(c => c.includes('>') || !roots.has(c)).join(' %% ');
}

function removeBrandsFromCategory(catStr) {
  if (!catStr) return catStr;
  const keep = [];
  for (const c of splitCategoryEntries(catStr)) {
    const partsNorm = c.split('>').map(p => norm(p));
    if (partsNorm.some(p => CATEGORIES_TO_REMOVE.has(p))) continue;
    keep.push(c);
  }
  return keep.join(' %% ');
}

function removeBrandCol(val) {
  return BRANDS_TO_REMOVE.has(norm(String(val))) ? '' : val;
}

// ---------- Precompute group counts ----------
const groupCounts = {};
for (const it of items) {
  const gid = it.json.group_id;
  if (gid !== undefined && gid !== null && String(gid).trim() !== '') {
    groupCounts[gid] = (groupCounts[gid] || 0) + 1;
  }
}

// ---------- Transform rows ----------
const HEADS = ['Tellerkopf','Senkkopf','Linsenkopf','Hammerkopf','ohne Kopf','Rundkopf','Zylinderkopf'];

const out = items.map(it => {
  const r = { ...it.json };

  // group_leader -> 'true'/'false'
  if (r.group_leader !== undefined) {
    const v = String(r.group_leader).trim();
    r.group_leader = (v === '1' || v.toLowerCase() === 'true') ? 'true' : 'false';
  }

  // group_count
  r.group_count = '';
  if (r.group_id !== undefined && r.group_id !== null && String(r.group_id).trim() !== '') {
    const n = groupCounts[r.group_id] || 1;
    r.group_count = n >= 2 ? `${n} Varianten` : '';
  }

  // category cleanup
  if (r.category !== undefined) {
    r.category = parseCategoryCell(r.category);
    r.category = cleanDuplicateFlatCategories(r.category);
    r.category = removeBrandsFromCategory(r.category);
  }

  // brand blacklist
  if (r.brand !== undefined) r.brand = removeBrandCol(r.brand);

  // ETA flag (column: 'eta-zulassung')
  if ('eta-zulassung' in r) {
    const inDesc  = (r.description || '').match(/ETA/i);
    const inTitle = (r.title || '').match(/ETA/i);
    if (inDesc || inTitle) r['eta-zulassung'] = 'mit ETA Zulassung';
  }

  // material from title
  r.material = '';
  const t = (r.title || '').toLowerCase();
  if (t.includes('edelstahl c1')) r.material = 'Edelstahl C1';
  else if (t.includes('edelstahl a2')) r.material = 'Edelstahl A2';
  else if (t.includes('edelstahl a4')) r.material = 'Edelstahl A4';
  else if (t.includes('gelb verzinkt')) r.material = 'Stahl gelb verzinkt';
  else if (!r.material && t.includes('verzinkt')) r.material = 'Stahl verzinkt';

  // kopfform from title
  r.kopfform = '';
  for (const h of HEADS) {
    if (new RegExp(h, 'i').test(r.title || '')) { r.kopfform = h; break; }
  }

  return { json: r };
});

return out;
