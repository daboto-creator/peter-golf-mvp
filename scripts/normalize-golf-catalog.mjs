import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const source = fs.readFileSync(path.join(root, "docs/catalog/golf-models-2020-2026-source.csv"), "utf8").replace(/^\uFEFF/, "");

function parseCsv(value) {
  const rows = [];
  let row = [], cell = "", quoted = false;
  for (let i = 0; i < value.length; i += 1) {
    const char = value[i];
    if (char === '"') {
      if (quoted && value[i + 1] === '"') { cell += '"'; i += 1; }
      else quoted = !quoted;
    } else if (char === "," && !quoted) { row.push(cell); cell = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && value[i + 1] === "\n") i += 1;
      row.push(cell); if (row.some((item) => item.trim())) rows.push(row);
      row = []; cell = "";
    } else cell += char;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

const brands = {
  "ADAMS GOLF": "Adams Golf", "BEN HOGAN GOLF": "Ben Hogan Golf",
  "BRIDGESTONE GOLF": "Bridgestone Golf", CALLAWAY: "Callaway",
  "CLEVELAND GOLF": "Cleveland Golf", COBRA: "Cobra", HONMA: "Honma",
  MIZUNO: "Mizuno", ODYSSEY: "Odyssey", PING: "PING", PXG: "PXG",
  "SCOTTY CAMERON": "Scotty Cameron", SRIXON: "Srixon", "SUB 70": "Sub 70",
  TAYLORMADE: "TaylorMade", TITLEIST: "Titleist", "TOUR EDGE": "Tour Edge",
  "WILSON STAFF": "Wilson Staff",
};
const categories = [["Driver", "driver"], ["Fairway Wood", "fairway-wood"], ["Hybrid", "hybrid"], ["Iron", "iron"], ["Wedge", "wedge"], ["Putter", "putter"]];
const placeholder = /^(?:-|N\/A|\(Hiatus\)|Hiatus)$/i;
const generic = /varios|various|modelos varios|standard models?|standard putters?|custom (?:wedges?|fairways?|putters?)|mallet (?:series|putters?)|phantom series|vault putters?|m-craft putters?|odyssey$/i;
const slugify = (value) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const rejected = [];
const accepted = new Map();
const addRejected = (brand, category, year, raw, reason) => rejected.push({ brand, category, year, raw, reason });

function expandCell(raw, brand, category, year) {
  const value = String(raw ?? "").trim();
  if (!value || placeholder.test(value)) { if (value) addRejected(brand, category, year, value, "placeholder_or_hiatus"); return []; }
  if (generic.test(value)) { addRejected(brand, category, year, value, "generic_placeholder_or_wrong_family"); return []; }
  if (brand === "TaylorMade" && /Epic/i.test(value)) { addRejected(brand, category, year, value, "belongs_to_callaway"); return []; }
  if (brand === "Mizuno" && ["driver", "fairway-wood", "hybrid"].includes(category) && /^JPX/i.test(value)) { addRejected(brand, category, year, value, "JPX_is_an_iron_family"); return []; }
  const match = value.match(/^(.+?)\s*\(([^()]*)\)$/);
  if (match) {
    const base = match[1].trim();
    const inside = match[2].trim();
    if (/[°]|\d+\s*[-–]\s*[A-Z]/i.test(inside)) return expandCell(base, brand, category, year);
    const variants = inside.split(/,\s*/).map((item) => item.trim()).filter(Boolean);
    return variants.flatMap((variant) => expandCell(variant === base ? base : `${base} ${variant}`, brand, category, year));
  }
  return value.split(/,\s*/).map((item) => item.trim()).filter(Boolean).flatMap((model) => {
    if (placeholder.test(model) || generic.test(model)) { addRejected(brand, category, year, model, "placeholder_or_generic"); return []; }
    const normalized = slugify(model);
    if (!normalized) { addRejected(brand, category, year, model, "empty_after_normalization"); return []; }
    const canonicalCategory = category.toUpperCase().replace("-", "_");
    const key = `${brand}|${canonicalCategory}|${normalized}`;
    const current = accepted.get(key);
    const candidate = { brand, category: canonicalCategory, model, modelYear: year, sourceStatus: "NORMALIZED_SOURCE" };
    if (!current || year < current.modelYear) accepted.set(key, candidate);
    return [candidate];
  });
}

const rows = parseCsv(source).slice(1);
for (const row of rows) {
  const brand = brands[row[0]];
  if (!brand) continue;
  const year = Number(row[1]);
  categories.forEach(([column, category]) => expandCell(row[["Driver", "Fairway Wood", "Hybrid", "Iron", "Wedge", "Putter"].indexOf(column) + 2], brand, category, year));
}

// Approved generation corrections from the catalog review. These are explicit
// source corrections, not inferred from first sale appearance.
function force(brand, category, model, modelYear) {
  const key = `${brand}|${category}|${slugify(model)}`;
  accepted.set(key, { brand, category, model, modelYear, sourceStatus: "VERIFIED" });
}
for (const [model, year] of [["SIM", 2020], ["SIM Max", 2020], ["SIM Max-D", 2020], ["SIM2", 2021], ["SIM2 Max", 2021], ["SIM2 Max-D", 2021], ["Stealth", 2022], ["Stealth HD", 2022], ["Stealth Plus", 2022], ["Stealth 2", 2023], ["Stealth 2 HD", 2023], ["Stealth 2 Plus", 2023], ["Qi10", 2024], ["Qi10 Max", 2024], ["Qi10 LS", 2024], ["Qi35", 2025], ["Qi35 Max", 2025], ["Qi35 LS", 2025], ["Qi4D", 2026], ["Qi4D Max", 2026], ["Qi4D Max Lite", 2026], ["Qi4D LS", 2026]]) force("TaylorMade", "DRIVER", model, year);
for (const [model, year] of [["TSi2", 2020], ["TSi3", 2020], ["TSR2", 2022], ["TSR3", 2022], ["TSR4", 2022], ["TSR1", 2023], ["GT2", 2024], ["GT3", 2024], ["GT4", 2024], ["GT280", 2025]]) force("Titleist", "DRIVER", model, year);
for (const [model, year] of [["Vokey SM8", 2020], ["Vokey SM9", 2022], ["Vokey SM10", 2024]]) force("Titleist", "WEDGE", model, year);
for (const [model, year] of [["ST200", 2020], ["ST-Z", 2021], ["ST-X", 2021], ["ST-Z 220", 2022], ["ST-X 220", 2022], ["ST-Z 230", 2023], ["ST-X 230", 2023], ["ST-MAX 230", 2024]]) force("Mizuno", "DRIVER", model, year);
for (const [model, year] of [["DS-ADAPT", 2025], ["DS-ADAPT LS", 2025], ["DS-ADAPT X", 2025], ["DS-ADAPT Max-K", 2025], ["DS-ADAPT Max-D", 2025]]) force("Cobra", "DRIVER", model, year);
for (const [model, year] of [["TW757", 2022], ["TW767", 2024]]) force("Honma", "DRIVER", model, year);
for (const key of [...accepted.keys()]) {
  const value = accepted.get(key);
  if ((value.brand === "Titleist" && value.category === "DRIVER" && /^(?:915D2|916D2|GTS drivers|GT280 \(mini driver\))$/i.test(value.model)) || /varios|standard|custom|series$/i.test(value.model)) accepted.delete(key);
}

const models = [...accepted.values()].sort((a, b) => a.brand.localeCompare(b.brand) || a.category.localeCompare(b.category) || a.model.localeCompare(b.model));
const docsDir = path.join(root, "docs/catalog");
fs.mkdirSync(docsDir, { recursive: true });
fs.writeFileSync(path.join(docsDir, "golf-models-normalized.json"), JSON.stringify(models, null, 2) + "\n");
fs.writeFileSync(path.join(docsDir, "golf-models-rejected.json"), JSON.stringify(rejected, null, 2) + "\n");
fs.writeFileSync(path.join(docsDir, "golf-models-normalized.md"), `# Modelos normalizados\n\n${models.length} modelos aceptados; ${rejected.length} entradas rechazadas.\n\n| Marca | Categoría | Modelo | Año | Estado |\n|---|---|---|---:|---|\n${models.map((m) => `| ${m.brand} | ${m.category} | ${m.model} | ${m.modelYear ?? ""} | ${m.sourceStatus} |`).join("\n")}\n`);

const sql = [];
sql.push("-- Generated from docs/catalog/golf-models-normalized.json; data-only and idempotent.");
sql.push("do $$ declare bid uuid; cid uuid; begin");
for (const model of models) {
  const brandSlug = slugify(model.brand);
  const categorySlug = model.category.toLowerCase().replace("_", "-");
  sql.push(`select id into bid from public.brands where slug='${brandSlug}'; select id into cid from public.categories where slug='${categorySlug}'; if bid is not null and cid is not null then update public.catalog_product_models set model_year=${model.modelYear} where brand_id=bid and category_id=cid and normalized_model_name='${slugify(model.model)}' and model_year is distinct from ${model.modelYear}; insert into public.catalog_product_models (brand_id,category_id,model_name,normalized_model_name,model_year,status,reference_source,reference_status) select bid,cid,'${model.model.replace(/'/g, "''")}','${slugify(model.model)}',${model.modelYear},'active','NORMALIZED_SOURCE','VERIFIED' where not exists (select 1 from public.catalog_product_models x where x.brand_id=bid and x.category_id=cid and x.normalized_model_name='${slugify(model.model)}' and x.model_year is not distinct from ${model.modelYear}); end if;`);
}
sql.push("update public.catalog_product_models set status='archived' where status='active' and (model_name ilike '%varios%' or model_name ilike '%standard%' or model_name ilike '%custom%' or model_name ilike '%series%' or model_name in ('Odyssey','Vault','Sigma','Mallet putters','Mallet series','Phantom series','M-Craft putters'));" );
sql.push("end $$;");
fs.writeFileSync(path.join(root, "supabase/migrations/20261007150000_expand_normalized_golf_catalog.sql"), sql.join("\n") + "\n");
console.log(JSON.stringify({rows: rows.length, accepted: models.length, rejected: rejected.length}));
