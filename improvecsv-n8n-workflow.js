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

// Parse '["Zubehör","Zubehör;Bits","Top Marken"]' to "Zubehör %% Zubehör > Bits"
function parseCategoryCell(cell) {
  if (cell == null || String(cell).trim() === '') return '';
  let v = String(cell).trim();

  // try JSON list first
  if (v.startsWith('[') && v.endsWith(']')) {
    try {
      // handle doubled quotes from CSV
      const fixed = v.replace(/\\"/g, '"').replace(/""/g, '"');
      const arr = JSON.parse(fixed);
      if (Array.isArray(arr)) {
        const out = arr
          .map(x => String(x).trim())
          .filter(Boolean)
          .map(entry => entry.includes(';')
            ? entry.split(';').map(s => s.trim()).filter(Boolean).join(' > ')
            : entry);
        return out.join(' %% ');
      }
    } catch { /* fall through */ }
  }

  // fallback: single string with semicolons
  if (v.includes(';')) return v.split(';').map(s => s.trim()).filter(Boolean).join(' > ');
  return v;
}

function cleanDuplicateFlatCategories(catStr) {
  if (!catStr) return catStr;
  const cats = catStr.split('%%').map(s => s.trim()).filter(Boolean);
  const trees = cats.filter(c => c.includes('>'));
  const roots = new Set(trees.map(tr => tr.split('>')[0].trim()));
  return cats.filter(c => c.includes('>') || !roots.has(c)).join(' %% ');
}

function removeBrandsFromCategory(catStr) {
  if (!catStr) return catStr;
  const keep = [];
  for (const c of catStr.split('%%').map(s => s.trim()).filter(Boolean)) {
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
  r.material = r.material || '';
  const t = (r.title || '').toLowerCase();
  if (t.includes('edelstahl c1')) r.material = 'Edelstahl C1';
  else if (t.includes('edelstahl a2')) r.material = 'Edelstahl A2';
  else if (t.includes('edelstahl a4')) r.material = 'Edelstahl A4';
  else if (t.includes('gelb verzinkt')) r.material = 'Stahl gelb verzinkt';
  else if (!r.material && t.includes('verzinkt')) r.material = 'Stahl verzinkt';

  // kopfform from title
  r.kopfform = r.kopfform || '';
  for (const h of HEADS) {
    if (new RegExp(h, 'i').test(r.title || '')) { r.kopfform = h; break; }
  }

  return { json: r };
});

return out;
