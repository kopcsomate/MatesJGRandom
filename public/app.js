const $ = (id) => document.getElementById(id);

let db = null;
let mode = "meta"; // meta | offmeta

// Data Dragon caches
let ddragonVersion = null;
let champByNumericKey = new Map(); // championId(number)->champion object
let runesById = new Map();         // perkId->icon url
let shardById = new Map();         // stat shard id->icon url
let spellsById = new Map();        // summonerSpellId->icon url

function pct(x) {
  return `${(x * 100).toFixed(1)}%`;
}
function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

async function fetchJSON(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed ${url}: ${res.status}`);
  return res.json();
}

async function initDataDragon() {
  // Get latest version list
  const versions = await fetchJSON("https://ddragon.leagueoflegends.com/api/versions.json");
  ddragonVersion = versions[0];

  // Champions
  const champData = await fetchJSON(`https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/data/en_US/championFull.json`);
  for (const [name, c] of Object.entries(champData.data)) {
    // c.key is numeric string ("107" for Rengar)
    champByNumericKey.set(Number(c.key), c);
  }

  // Items: we only need icons by ID (no fetch necessary; icons are predictable)
  // Runes + shards icons
// Runes + shards (perks.json includes keystones, minors, and stat shards like 5005/5008/5001)
// --- RUNES (keystones + minors) from Data Dragon ---
const runesReforged = await fetchJSON(
  `https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/data/en_US/runesReforged.json`
);

// runesReforged is an array of rune trees, each has slots -> runes[]
for (const tree of runesReforged) {
  for (const slot of tree.slots || []) {
    for (const r of slot.runes || []) {
      // r.id is numeric, r.icon is like "perk-images/Styles/Precision/Conqueror/Conqueror.png"
      runesById.set(
        Number(r.id),
        `https://ddragon.leagueoflegends.com/cdn/img/${r.icon}`
      );
    }
  }
}

console.log("runesById size (ddragon):", runesById.size);

// --- STAT SHARDS (5005/5008/5001) from CommunityDragon ---
const shardIds = [5005, 5008, 5001];
for (const id of shardIds) {
  runesById.set(
    id,
    `https://raw.communitydragon.org/latest/lol-game-data/assets/v1/perk-images/StatMods/StatMods${id}.png`
  );
}



  // Summoner spells
  const summ = await fetchJSON(`https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/data/en_US/summoner.json`);
  for (const s of Object.values(summ.data)) {
    // s.key is numeric string like "4" for Flash
    spellsById.set(Number(s.key), `https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/img/spell/${s.image.full}`);
  }

  $("patchBadge").textContent = `Patch ${ddragonVersion}`;
}

function champIconUrl(champ) {
  return `https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/img/champion/${champ.image.full}`;
}
function itemIconUrl(itemId) {
  return `https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/img/item/${itemId}.png`;
}

function setMode(newMode) {
  mode = newMode;
  $("modeMeta").classList.toggle("active", mode === "meta");
  $("modeOff").classList.toggle("active", mode === "offmeta");
  $("modeMeta").setAttribute("aria-selected", mode === "meta");
  $("modeOff").setAttribute("aria-selected", mode === "offmeta");
  $("modeBadge").textContent = mode === "meta" ? "Normal Junglers" : "Off-meta";
}

function getPool() {
  return mode === "meta" ? db.pools.meta : db.pools.offmeta;
}

function renderIcons(el, urls, extraClass = "icon") {
  clear(el);
  for (const u of urls.filter(Boolean)) {
    const img = document.createElement("img");
    img.className = extraClass;
    img.src = u;
    img.loading = "lazy";
    img.alt = "";
    el.appendChild(img);
  }
}

function renderRunes(pick) {
  const b = pick.builds?.[0];
  const perks = b?.sample?.perks;
  const styles = perks?.styles ?? [];
  const statPerks = perks?.statPerks ?? null;

  // Primary & secondary selections
  const primary = styles.find(s => s.description === "primaryStyle") ?? styles[0];
  const secondary = styles.find(s => s.description === "subStyle") ?? styles[1];

  const pIcons = [];
  const sIcons = [];

  if (primary?.selections?.length) {
    // Keystone first, then minors
    for (const sel of primary.selections) {
      const url = runesById.get(Number(sel.perk));
      if (url) pIcons.push(url);
    }
  }
  if (secondary?.selections?.length) {
    for (const sel of secondary.selections) {
      const url = runesById.get(Number(sel.perk));
      if (url) sIcons.push(url);
    }
  }

// --- STAT SHARDS (5005/5008/5001) from Data Dragon ---
// Riot uses these filenames for the stat mods:
const shardIconById = {
  5005: `https://ddragon.leagueoflegends.com/cdn/img/perk-images/StatMods/StatModsAdaptiveForceIcon.png`,
  5008: `https://ddragon.leagueoflegends.com/cdn/img/perk-images/StatMods/StatModsAttackSpeedIcon.png`,
  5001: `https://ddragon.leagueoflegends.com/cdn/img/perk-images/StatMods/StatModsHealthScalingIcon.png`,
};

for (const [id, url] of Object.entries(shardIconById)) {
  runesById.set(Number(id), url);
}


  // Bigger icons for the first row (keystone stands out)
  clear($("runesPrimary"));
  pIcons.forEach((u, idx) => {
    const img = document.createElement("img");
    img.className = idx === 0 ? "rune big" : "rune";
    img.src = u;
    img.loading = "lazy";
    img.alt = "";
    $("runesPrimary").appendChild(img);
  });

  renderIcons($("runesSecondary"), sIcons, "rune");
  renderIcons($("runeShards"), shardIcons, "rune");
}

function renderPick(pick) {
  const champ = champByNumericKey.get(Number(pick.championId));
  const champName = champ?.name ?? `Champion #${pick.championId}`;

  $("champName").textContent = champName;
  $("champIcon").src = champ ? champIconUrl(champ) : "";
  $("champIcon").alt = champName;

  $("wr").textContent = pct(pick.winrate);
  $("games").textContent = String(pick.games);
  $("pr").textContent = pct(pick.pickrate);

  // Build sample
  const b = pick.builds?.[0];
  $("bwr").textContent = b ? pct(b.winrate) : "—";
  $("bgames").textContent = b ? String(b.games) : "—";

  // Items (use sample.items array, show first 6)
  const items = (b?.sample?.items ?? []).filter(x => Number.isInteger(x) && x > 0).slice(0, 6);
  renderIcons($("items"), items.map(itemIconUrl), "icon");
  $("itemsText").textContent = items.length ? items.join(" • ") : "No item data";

  // Spells
  const spells = (b?.sample?.summonerSpells ?? []).map(Number).filter(Boolean);
  renderIcons($("spells"), spells.map(id => spellsById.get(id)), "icon");

  // Runes
  renderRunes(pick);

  // Footer
  $("generatedAt").textContent = db?.generatedAt ? `Generated: ${db.generatedAt}` : "";
}

function roll() {
  const pool = getPool();
  const pick = pickRandom(pool);
  renderPick(pick);
}

async function main() {
  setMode("meta");

  $("modeMeta").addEventListener("click", () => { setMode("meta"); roll(); });
  $("modeOff").addEventListener("click", () => { setMode("offmeta"); roll(); });
  $("rollBtn").addEventListener("click", roll);

  // Load dataset
  db = await fetchJSON("./data/jungle_diamond_plus.json");

  // Sidebar dataset stats
  $("totalJungle").textContent = String(db.totals.totalJungleGames ?? "—");
  $("qualified").textContent = String(db.totals.qualifiedChampions ?? "—");
  $("metaCount").textContent = String(db.totals.metaChampions ?? "—");
  $("offCount").textContent = String(db.totals.offmetaChampions ?? "—");

  await initDataDragon();
  roll();
}

main().catch((e) => {
  console.error(e);
  $("champName").textContent = "Error loading data";
});
