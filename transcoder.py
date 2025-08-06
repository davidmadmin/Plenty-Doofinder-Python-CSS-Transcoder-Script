import pandas as pd
import os
from datetime import datetime
import ast
import unicodedata
import re
import csv

# --- Blacklists ---
BRANDS_TO_REMOVE = [
    'Klimas Sp', 'Top Marken', 'EFF EFF', 'E.u.r.o Tec GmbH', 'Förch', 'Meisterling',
    'Beurskens', 'Fenster-Hammer', 'EVVA', 'Hanno', 'Heicko', 'K-A-L-M', 'DIAGER',
    'Medid', 'Zaunrebell', 'FENSTER-HAMMER', 'SCHRAUBEN-HAMMER',
]
CATEGORIES_TO_REMOVE = [
    'SCREWREBEL', 'WERA', 'Klimas Sp', 'Top Marken', 'FAMAG', 'INTRA-TEC', 'Pica',
    'Burg Wächter', 'ISEO', 'BEVER', 'EFF EFF', 'ABUS', 'INDEX',
]

def normalize_str(s):
    if not isinstance(s, str):
        return ''
    s = unicodedata.normalize('NFKC', s)
    s = re.sub(r'\s+', ' ', s)
    return s.strip().lower()

BRANDS_TO_REMOVE_SET = set(normalize_str(b) for b in BRANDS_TO_REMOVE)
CATEGORIES_TO_REMOVE_SET = set(normalize_str(c) for c in CATEGORIES_TO_REMOVE)


def parse_category(cell):
    if pd.isnull(cell) or cell in [None, float('nan')]:
        return ''
    try:
        cell_str = str(cell)
        val = ast.literal_eval(cell_str)
        if isinstance(val, list):
            clean = [str(x).strip() for x in val if str(x).strip()]
            if not clean:
                return ''
            out = []
            for entry in clean:
                if ';' in entry:
                    out.append(' > '.join([e.strip() for e in entry.split(';') if e.strip()]))
                else:
                    out.append(entry)
            return ' %% '.join(out)
        elif isinstance(val, str) and ';' in val:
            return ' > '.join([e.strip() for e in val.split(';') if e.strip()])
        elif isinstance(val, str) and val.strip():
            return val.strip()
        else:
            return ''
    except Exception:
        if not cell or str(cell).strip() in ['[]', '["" ]', ""]:
            return ''
        return str(cell).strip()


def clean_duplicate_flat_categories(cat_str):
    if not cat_str or not isinstance(cat_str, str):
        return cat_str
    cats = [c.strip() for c in cat_str.split('%%')]
    flat = [c for c in cats if '>' not in c]
    trees = [c for c in cats if '>' in c]
    tree_roots = set(t.strip() for t in [tr.split('>')[0] for tr in trees])
    result = [c for c in cats if (('>' in c) or (c not in tree_roots))]
    result = [r.strip() for r in result if r.strip()]
    return ' %% '.join(result)


def remove_brands_from_category(cat_str):
    if not cat_str or not isinstance(cat_str, str):
        return cat_str
    cats = [c.strip() for c in cat_str.split('%%')]
    filtered = []
    for c in cats:
        parts = [p.strip() for p in c.split('>')]
        parts_normalized = [normalize_str(part) for part in parts]
        if any(p in CATEGORIES_TO_REMOVE_SET for p in parts_normalized):
            continue
        filtered.append(c)
    return ' %% '.join(filtered)


def remove_brands_from_brand_col(val):
    return '' if normalize_str(str(val)) in BRANDS_TO_REMOVE_SET else val


def process_csv(csv_path: str) -> str:
    """Process a CSV file and return the output path."""
    if csv_path.startswith('"') and csv_path.endswith('"'):
        csv_path = csv_path[1:-1]
    if not os.path.exists(csv_path):
        raise FileNotFoundError(csv_path)

    df = pd.read_csv(csv_path, sep=';', dtype=str)

    if 'group_leader' in df.columns:
        df['group_leader'] = df['group_leader'].map(
            lambda x: 'true' if str(x).strip() in ['1', 'True', 'true'] else 'false'
        )
    if 'group_id' in df.columns:
        group_counts = df['group_id'].value_counts()
        def gruppen_varianten(gid):
            anzahl = group_counts.get(gid, 1)
            return f"{anzahl} Varianten" if anzahl >= 2 else ""
        df['group_count'] = df['group_id'].map(gruppen_varianten)

    if 'category' in df.columns:
        df['category'] = df['category'].map(parse_category)
        df['category'] = df['category'].map(clean_duplicate_flat_categories)
        df['category'] = df['category'].map(remove_brands_from_category)

    if 'brand' in df.columns:
        df['brand'] = df['brand'].map(remove_brands_from_brand_col)

    if 'eta-zulassung' in df.columns:
        eta_in_description = (
            df['description'].astype(str).str.contains(r'ETA', case=True, na=False)
            if 'description' in df.columns else False
        )
        eta_in_title = (
            df['title'].astype(str).str.contains(r'ETA', case=True, na=False)
            if 'title' in df.columns else False
        )
        eta_mask = eta_in_description | eta_in_title
        df.loc[eta_mask, 'eta-zulassung'] = 'mit ETA Zulassung'

    basename = os.path.basename(csv_path)
    basename_ohne_ext = os.path.splitext(basename)[0]
    zeit = datetime.now().strftime('%Y-%m-%d_%H-%M')
    out_name = f"{basename_ohne_ext} Python CSV Edit {zeit}.csv"
    output_pfad = os.path.join(os.path.dirname(csv_path), out_name)
    df.to_csv(output_pfad, index=False, sep=';', quoting=csv.QUOTE_NONNUMERIC)
    return output_pfad
