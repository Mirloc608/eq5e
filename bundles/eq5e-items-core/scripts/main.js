/**
 * EQ5e Core Itemization
 * - Imports level-banded equipment into WORLD compendiums
 * - Builds tiered RollTables (Trash/Named/Boss) that reference those compendiums
 *
 * NOTE: We import into world packs so they remain editable and can be extended by expansion modules later.
 */
const MOD = "eq5e-items-core";

const PACKS = {
  weapons:  { collection: "world.eq5e-items-weapons-core", itemType: "weapon", label: "EQ5e Items – Weapons (Core)",  type: "Item" },
  armor:    { collection: "world.eq5e-items-armor-core", itemType: "armor",   label: "EQ5e Items – Armor (Core)",    type: "Item" },
  shields:  { collection: "world.eq5e-items-shields-core", itemType: "shield", label: "EQ5e Items – Shields (Core)",  type: "Item" },
  jewelry:  { collection: "world.eq5e-items-jewelry-core", itemType: "jewelry", label: "EQ5e Items – Jewelry (Core)",  type: "Item" },
  jewelryAC:{ collection: "world.eq5e-items-jewelry-ac-rare", itemType: "jewelry", label: "EQ5e Items – Jewelry (AC Rare)", type: "Item" },
  consum:   { collection: "world.eq5e-items-consumables-core", itemType: "consumable", label: "EQ5e Items – Consumables (Core)", type: "Item" },
  loot:     { collection: "world.eq5e-loot-core", label: "EQ5e Loot Tables (Core)", type: "RollTable" },
  vendors:  { collection: "world.eq5e-vendors-core", label: "EQ5e Vendor Tables (Core)", type: "RollTable" }
};


function _modulePath(moduleId, rel) {
  // If running as a separate module, use its path.
  try {
    const mod = game.modules?.get(moduleId);
    if (mod?.active && mod?.path) return `${mod.path}/${rel}`;
  } catch (e) {}
  // Bundled into the system: fall back to system bundle folder.
  return `systems/eq5e/bundles/${moduleId}/${rel}`;
}

async function fetchJSON(path) {
  const res = await fetch(path);
  const ct = res.headers.get("content-type") || "";
  if (!res.ok) throw new Error(`Fetch failed ${res.status} for ${path}`);

  if (!ct.includes("application/json")) {
    const preview = (await res.text()).slice(0, 120).replace(/\s+/g, " ");
    throw new Error(`Fetch failed: non-JSON response for ${path}: ${preview}`);
  }
  return res.json();
}


function priceCPFromItem(item) {
  return item?.system?.eq5e?.price?.cp ?? item?.flags?.eq5e?.price?.cp ?? 0;
}

function formatPrice(cp) {
  cp = Math.max(0, Number(cp) || 0);
  const gp = Math.floor(cp / 100);
  const sp = Math.floor((cp % 100) / 10);
  const c  = Math.floor(cp % 10);
  const parts = [];
  if (gp) parts.push(`${gp}gp`);
  if (sp) parts.push(`${sp}sp`);
  if (c || !parts.length) parts.push(`${c}cp`);
  return parts.join(" ");
}

async function ensureWorldPack({collection,label,type}) {
  let pack = game.packs.get(collection);
  if (pack) return pack;
  // Create world compendium
  // Foundry v13: CompendiumCollection.createCompendium
  const [scope, name] = collection.split(".");
  if (scope !== "world") throw new Error(`Expected world pack: ${collection}`);
  pack = await CompendiumCollection.createCompendium({
    label,
    name,
    type,
    system: game.system.id
  });
  return pack;
}

function keyFor(itemData) {
  return itemData?.flags?.eq5e?.itemId ?? null;
}

function sanitizeItemForPack(raw, defaultType) {
  const d = foundry.utils.deepClone(raw ?? {});
  if (d.documentName && d.documentName !== "Item") return null;

  let t = d.type;
  if (typeof t !== "string") t = t == null ? "" : String(t);
  t = t.trim();

  const validTypes = Object.keys(game.system?.documentTypes?.Item ?? {});
  if (!t || !validTypes.includes(t)) t = defaultType;
  d.type = t;

  if (d.data && !d.system) {
    d.system = d.data;
    delete d.data;
  }

  d.flags = d.flags ?? {};
  d.flags.eq5e = d.flags.eq5e ?? {};
  return d;
}

async function upsertPackItems(pack, items, { defaultType = "item" } = {}) {
  const docs = await pack.getDocuments();
  const byKey = new Map(docs.map(d => [d.flags?.eq5e?.itemId, d]));
  const toCreate = [];
  const toUpdate = [];

  for (const raw of (items ?? [])) {
    const it = sanitizeItemForPack(raw, defaultType);
    if (!it) continue;

    const k = keyFor(it);
    if (!k) continue;

    const existing = byKey.get(k);
    if (!existing) {
      toCreate.push(it);
    } else {
      const upd = foundry.utils.deepClone(it);
      upd._id = existing.id;
      toUpdate.push(upd);
    }
  }

  if (toCreate.length) await pack.documentClass.createDocuments(toCreate, { pack: pack.collection });
  if (toUpdate.length) await pack.documentClass.updateDocuments(toUpdate, { pack: pack.collection, recursive: false });
  return { created: toCreate.length, updated: toUpdate.length };
}

async function buildTieredLootTables(packs) {
  const lootPack = packs.loot;
  await lootPack.getIndex(); // ensure loaded

  const weaponDocs = await packs.weapons.getDocuments();
  const armorDocs  = await packs.armor.getDocuments();
  const shieldDocs = await packs.shields.getDocuments();
  const jewelDocs  = await packs.jewelry.getDocuments();
  const rareJewel  = await packs.jewelryAC.getDocuments();
  const consumDocs = await packs.consum.getDocuments();

  const tiers = Array.from({length:12}, (_,i)=>i+1);

  function pickMany(docs, n) {
  const arr = Array.from(docs);
  // stable-ish shuffle
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, Math.min(n, arr.length));
}

function docsForTier(docs, tier) {
    return docs.filter(d => (d.flags?.eq5e?.tier ?? d.system?.eq5e?.tier) === tier);
  }

  // Helper to make compendium result
  function compResult(doc) {
    return {
      type: 2, // COMPENDIUM
      collection: doc.pack, // e.g. "world.eq5e-items-weapons-core"
      resultId: doc.id,
      text: doc.name,
      img: doc.img
    };
  }

  // Create or update a RollTable by name
  async function upsertTable(name, results) {
    const existing = (await lootPack.getDocuments()).find(t => t.name === name);
    const data = {
      name,
      replacement: true,
      displayRoll: true,
      results: results.map((r, idx) => ({
        _id: foundry.utils.randomID(),
        type: r.type,
        collection: r.collection,
        resultId: r.resultId,
        text: r.text,
        img: r.img,
        weight: r.weight ?? 1,
        range: [idx+1, idx+1], // will be normalized by Foundry on update
        drawn: false
      }))
    };

    if (!existing) {
      await lootPack.documentClass.createDocuments([data], {pack: lootPack.collection});
    } else {
      data._id = existing.id;
      await lootPack.documentClass.updateDocuments([data], {pack: lootPack.collection, recursive: false});
    }
  }

  // Build tables per tier: Trash/Named/Boss
  for (const tier of tiers) {
    const w = docsForTier(weaponDocs, tier);
    const a = docsForTier(armorDocs, tier);
    const s = docsForTier(shieldDocs, tier);
    const j = docsForTier(jewelDocs, tier);
    const c = docsForTier(consumDocs, tier);
    const rj = docsForTier(rareJewel, tier);

// Even balance target per tier via weights, but with more variety in the candidate list.
// Trash: mostly templates. Named/Boss: broader spread + rare AC jewelry gated here only.
const trash = [];
const named = [];
const boss = [];

// Pick multiple candidates per category so the tables feel varied without exploding in size.
const wT = pickMany(w, 6);
const aT = pickMany(a, 10);
const sT = pickMany(s, 2);
const jT = pickMany(j, 5);
const cT = pickMany(c, 2);

// Trash mix
for (const d of wT.slice(0, 3)) trash.push({...compResult(d), weight: 3});
for (const d of aT.slice(0, 4)) trash.push({...compResult(d), weight: 3});
for (const d of sT.slice(0, 1)) trash.push({...compResult(d), weight: 2});
for (const d of jT.slice(0, 2)) trash.push({...compResult(d), weight: 2});
for (const d of cT.slice(0, 1)) trash.push({...compResult(d), weight: 1});

// Named mix (better spread)
for (const d of wT.slice(0, 4)) named.push({...compResult(d), weight: 3});
for (const d of aT.slice(0, 5)) named.push({...compResult(d), weight: 3});
for (const d of sT.slice(0, 2)) named.push({...compResult(d), weight: 2});
for (const d of jT.slice(0, 3)) named.push({...compResult(d), weight: 2});
for (const d of cT.slice(0, 1)) named.push({...compResult(d), weight: 1});
if (rj[0]) named.push({...compResult(rj[0]), weight: 1}); // very rare AC jewelry

// Boss mix (best)
for (const d of wT.slice(0, 5)) boss.push({...compResult(d), weight: 3});
for (const d of aT.slice(0, 6)) boss.push({...compResult(d), weight: 3});
for (const d of sT.slice(0, 2)) boss.push({...compResult(d), weight: 2});
for (const d of jT.slice(0, 4)) boss.push({...compResult(d), weight: 2});
for (const d of cT.slice(0, 2)) boss.push({...compResult(d), weight: 1});
if (rj[0]) boss.push({...compResult(rj[0]), weight: 2}); // still rare

    await upsertTable(`EQ5e Loot – Trash (T${tier})`, trash);
    await upsertTable(`EQ5e Loot – Named (T${tier})`, named);
    await upsertTable(`EQ5e Loot – Boss (T${tier})`, boss);
  }
}


function isBow(doc) {
  const skill = doc?.system?.eq5e?.weapon?.skill;
  return skill === "archery";
}
function isThrow(doc) {
  const skill = doc?.system?.eq5e?.weapon?.skill;
  return skill === "throwing";
}
function isMeleeWeapon(doc) {
  const skill = doc?.system?.eq5e?.weapon?.skill;
  return ["slash","pierce","blunt","2hslash","2hblunt","2hpierce"].includes(skill);
}

function vendorPriceCapCP() {
  // Returns a CP cap for vendor pricing tables (integer). Defaults to 5000cp (50gp).
  try {
    const v = game?.settings?.get?.("eq5e", "vendorPriceCapCP");
    const n = Number(v);
    if (Number.isFinite(n) && n >= 0) return Math.floor(n);
  } catch (e) {}
  return 5000;
}

function filterByTierAndPrice(docs, tier, capCP, exactTier=true) {
  return docs.filter(d => {
    const t = (d.flags?.eq5e?.tier ?? d.system?.eq5e?.tier) ?? 1;
    if (exactTier ? (t !== tier) : (t > tier)) return false;
    const cp = priceCPFromItem(d);
    return cp <= capCP;
  });
}

async function buildVendorTables(packs) {
  const vendorPack = packs.vendors;
  await vendorPack.getIndex();

  const weaponDocs = await packs.weapons.getDocuments();
  const armorDocs  = await packs.armor.getDocuments();
  const shieldDocs = await packs.shields.getDocuments();
  const jewelDocs  = await packs.jewelry.getDocuments();
  const consumDocs = await packs.consum.getDocuments();

  const tiers = Array.from({length:12}, (_,i)=>i+1);

  function docsForTier(docs, tier) {
    return docs.filter(d => (d.flags?.eq5e?.tier ?? d.system?.eq5e?.tier) === tier);
  }

  function compResult(doc) {
    return {
      type: 2,
      collection: doc.pack,
      resultId: doc.id,
      text: doc.name,
      img: doc.img
    };
  }

  async function upsertTable(name, results) {
    const existing = (await vendorPack.getDocuments()).find(t => t.name === name);
    const data = {
      name,
      replacement: true,
      displayRoll: true,
      results: results.map((r, idx) => ({
        _id: foundry.utils.randomID(),
        type: r.type,
        collection: r.collection,
        resultId: r.resultId,
        text: r.text,
        img: r.img,
        weight: r.weight ?? 1,
        range: [idx+1, idx+1],
        drawn: false
      }))
    };
    if (!existing) {
      await vendorPack.documentClass.createDocuments([data], {pack: vendorPack.collection});
    } else {
      data._id = existing.id;
      await vendorPack.documentClass.updateDocuments([data], {pack: vendorPack.collection, recursive: false});
    }
  }

  // Build per-tier vendor tables (popular shop archetypes)
  for (const tier of tiers) {
    // Blacksmith: melee weapons + throwing
    const capW = vendorPriceCapCP(tier, "weapons");
    const wTier = docsForTier(weaponDocs, tier);
    const blacksmith = filterByTierAndPrice(wTier.filter(d => isMeleeWeapon(d) || isThrow(d)), tier, capW, true);

    // Armorer: armor + shields
    const capA = vendorPriceCapCP(tier, "armor");
    const aTier = docsForTier(armorDocs, tier);
    const sTier = docsForTier(shieldDocs, tier);
    const armorer = filterByTierAndPrice(aTier, tier, capA, true);
    const shields = filterByTierAndPrice(sTier, tier, capA, true);

    // Fletcher: bows + throwing
    const capF = vendorPriceCapCP(tier, "fletcher");
    const fletcher = filterByTierAndPrice(wTier.filter(d => isBow(d) || isThrow(d)), tier, capF, true);

    // Jeweler: jewelry (no AC jewelry here)
    const capJ = vendorPriceCapCP(tier, "jeweler");
    const jTier = docsForTier(jewelDocs, tier);
    const jeweler = filterByTierAndPrice(jTier, tier, capJ, true);

    // General store: consumables + a small selection of basics (cheapest in-tier weapons/armor)
    const capG = vendorPriceCapCP(tier, "general");
    const cTier = docsForTier(consumDocs, tier);
    const generalConsum = filterByTierAndPrice(cTier, tier, capG, true);

    // basic picks: lowest-price 3 weapons + lowest-price 3 armor
    const cheapWeapons = wTier.slice().sort((a,b)=>priceCPFromItem(a)-priceCPFromItem(b)).slice(0,3).filter(d=>priceCPFromItem(d)<=capG);
    const cheapArmor = aTier.slice().sort((a,b)=>priceCPFromItem(a)-priceCPFromItem(b)).slice(0,3).filter(d=>priceCPFromItem(d)<=capG);

    const toResults = (docs, baseWeight=1) => docs.map(d => ({...compResult(d), weight: baseWeight}));

    await upsertTable(`EQ5e Vendor – Blacksmith (T${tier})`, [
      ...toResults(blacksmith, 1)
    ]);

    await upsertTable(`EQ5e Vendor – Armorer (T${tier})`, [
      ...toResults(armorer, 1),
      ...toResults(shields, 1)
    ]);

    await upsertTable(`EQ5e Vendor – Fletcher (T${tier})`, [
      ...toResults(fletcher, 1)
    ]);

    await upsertTable(`EQ5e Vendor – Jeweler (T${tier})`, [
      ...toResults(jeweler, 1)
    ]);

    await upsertTable(`EQ5e Vendor – General Store (T${tier})`, [
      ...toResults(generalConsum, 2),
      ...toResults(cheapWeapons, 1),
      ...toResults(cheapArmor, 1)
    ]);
  }
}


function formatQuality(q, c) {
  q = (q||"standard"); c = (c||"mint");
  const cap = (s)=>String(s).charAt(0).toUpperCase()+String(s).slice(1);
  return `${cap(q)} / ${cap(c)}`;
}
function effectiveValueCP(item) {
  const base = priceCPFromItem(item);
  const q = item?.flags?.eq5e?.quality ?? "standard";
  const c = item?.flags?.eq5e?.condition ?? "mint";
  const qm = ({ worn:0.85, standard:1.0, fine:1.15, exquisite:1.30 }[String(q).toLowerCase()] ?? 1.0);
  const cm = ({ used:0.90, mint:1.0 }[String(c).toLowerCase()] ?? 1.0);
  return Math.max(0, Math.round(base * qm * cm));
}
function previewSellCP(item) {
  const base = effectiveValueCP(item);
  const m = (game.settings?.get?.("eq5e","vendorMarkup") ?? 1.20);
  return Math.max(0, Math.round(base * m));
}
function previewBuybackCP(item) {
  const base = effectiveValueCP(item);
  const b = (game.settings?.get?.("eq5e","vendorBuyback") ?? 0.40);
  return Math.max(0, Math.round(base * b));
}

function vendorSellPriceCP(item, {markup=null}={}) {
  const base = priceCPFromItem(item);
  const m = markup ?? (game.settings?.get?.("eq5e", "vendorMarkup") ?? 1.20);
  return Math.max(0, Math.round(base * m));
}

function vendorBuybackPriceCP(item, {buyback=null}={}) {
  const base = priceCPFromItem(item);
  const b = buyback ?? (game.settings?.get?.("eq5e", "vendorBuyback") ?? 0.40);
  return Math.max(0, Math.round(base * b));
}

function canRestockVendorNow(actor) {
  const next = actor?.flags?.eq5e?.vendor?.nextRestockAt ?? 0;
  return Date.now() >= next;
}

async function setNextRestock(actor, days=null) {
  if (!actor) return;
  const d = days ?? (game.settings?.get?.("eq5e", "vendorRestockDays") ?? 3);
  const ms = Math.max(1, Number(d) || 3) * 24 * 60 * 60 * 1000;
  await actor.setFlag("eq5e", "vendor.nextRestockAt", Date.now() + ms);
}

async function restockVendor(actor, {force=false}={}) {
  if (!actor) return;
  if (!game.user.isGM) return ui.notifications?.warn?.("EQ5e: Only the GM can restock vendors.");
  const v = actor.flags?.eq5e?.vendor;
  if (!v) return ui.notifications?.warn?.("EQ5e: This actor is not marked as a vendor.");

  if (!force && !canRestockVendorNow(actor)) {
    const next = new Date(v.nextRestockAt).toLocaleString();
    return ui.notifications?.info?.(`Vendor not ready to restock until ${next}`);
  }

  await generateVendorInventory({
    tier: v.tier ?? 1,
    shop: v.shop ?? "general",
    count: v.count ?? 18,
    flavor: v.flavor ?? "neutral",
    persist: true,
    actorName: actor.name
  });

  await setNextRestock(actor);
}


function getActorCPFlag(actor) {
  return Number(actor?.getFlag?.("eq5e", "currency.cp") ?? 0) || 0;
}

function formatCP(cp) {
  cp = Math.max(0, Number(cp)||0);
  const gp = Math.floor(cp / 100);
  const sp = Math.floor((cp % 100) / 10);
  const c  = Math.floor(cp % 10);
  const parts = [];
  if (gp) parts.push(`${gp}gp`);
  if (sp) parts.push(`${sp}sp`);
  if (c || !parts.length) parts.push(`${c}cp`);
  return parts.join(" ");
}

async function requestVendorBuy({buyer, vendor, vendorItem, quantity=1}) {
  if (!buyer || !vendor || !vendorItem) return;
  if (game.user.isGM) {
    // GM can execute immediately via socket handler logic on GM client (still uses system handler)
    game.socket?.emit("system.eq5e", { type:"eq5e.vendorBuy", userId: game.user.id, buyerActorUuid: buyer.uuid, vendorActorUuid: vendor.uuid, vendorItemId: vendorItem.id, quantity });
  } else {
    game.socket?.emit("system.eq5e", { type:"eq5e.vendorBuy", userId: game.user.id, buyerActorUuid: buyer.uuid, vendorActorUuid: vendor.uuid, vendorItemId: vendorItem.id, quantity });
  }
}

async function requestVendorSell({seller, vendor, sellerItem, quantity=1}) {
  if (!seller || !vendor || !sellerItem) return;
  game.socket?.emit("system.eq5e", { type:"eq5e.vendorSell", userId: game.user.id, sellerActorUuid: seller.uuid, vendorActorUuid: vendor.uuid, sellerItemId: sellerItem.id, quantity });
}

async function openVendorShopDialog(vendorActor) {
  const buyer = game.user.character;
  if (!buyer) return ui.notifications?.warn?.("Set a Character for this user to buy/sell.");

  const vItems = vendorActor.items.contents;
  const bItems = buyer.items.contents.filter(i => !i.flags?.eq5e?.vendorItem);

  const rowsBuy = vItems.map(i => {
    const cp = game.eq5e?.itemization?.vendorSellPriceCP ? game.eq5e.itemization.vendorSellPriceCP(i) : (game.eq5e?.vendorSellPriceCP ? game.eq5e.vendorSellPriceCP(i) : (i.system?.eq5e?.price?.cp ?? 0));
    return `<tr data-id="${i.id}">
      <td style="white-space:nowrap"><img src="${i.img}" width="24" height="24" style="vertical-align:middle; margin-right:6px"> ${i.name}</td>
      <td style="text-align:right">${formatCP(cp)}</td>
      <td style="text-align:right">${Number(i.system?.eq5e?.quantity ?? 1) || 1}</td>
      <td style="text-align:right"><button type="button" class="eq5e-buy1" data-id="${i.id}">Buy 1</button> <button type="button" class="eq5e-buyx" data-id="${i.id}">Buy X</button></td>
    </tr>`;
  }).join("");

  const rowsSell = bItems.slice(0, 40).map(i => {
    const cp = game.eq5e?.itemization?.vendorBuybackPriceCP ? game.eq5e.itemization.vendorBuybackPriceCP(i) : (game.eq5e?.vendorBuybackPriceCP ? game.eq5e.vendorBuybackPriceCP(i) : Math.round((i.system?.eq5e?.price?.cp ?? 0)*0.4));
    return `<tr data-id="${i.id}">
      <td style="white-space:nowrap"><img src="${i.img}" width="24" height="24" style="vertical-align:middle; margin-right:6px"> ${i.name}</td>
      <td style="text-align:right">${formatCP(cp)}</td>
      <td style="text-align:right">${Number(i.system?.eq5e?.quantity ?? 1) || 1}</td>
      <td style="text-align:right"><button type="button" class="eq5e-sell1" data-id="${i.id}">Sell 1</button> <button type="button" class="eq5e-sellx" data-id="${i.id}">Sell X</button> <button type="button" class="eq5e-sellall" data-id="${i.id}">Sell All</button></td>
    </tr>`;
  }).join("");

  const html = `
    <div style="display:flex; gap:10px; align-items:flex-start;">
      <div style="flex:1;">
        <h3>Buy from ${vendorActor.name}</h3>
        <p style="opacity:0.85;">Your funds: <b>${formatCP(getActorCPFlag(buyer))}</b> &nbsp; Vendor funds: <b>${(game.settings?.get?.("eq5e","vendorsInfiniteFunds") ?? true) ? "∞" : formatCP(getActorCPFlag(vendorActor))}</b></p><div style="display:flex; gap:10px; align-items:center; margin:6px 0 10px 0;"><label style="opacity:0.9;">Qty:</label><input id="eq5e-shop-qty" type="number" min="1" value="1" style="width:72px;"><span style="opacity:0.8; font-size:0.9em;">(applies to “Buy X” / “Sell X”)</span></div>
        <div style="max-height:380px; overflow:auto;">
          <table style="width:100%;"><tbody>${rowsBuy}</tbody></table>
        </div>
      </div>
      <div style="flex:1;">
        <h3>Sell to ${vendorActor.name}</h3>
        <p style="opacity:0.85;">Sellback uses buyback rate.</p>
        <div style="max-height:380px; overflow:auto;">
          <table style="width:100%;"><tbody>${rowsSell}</tbody></table>
        </div>
      </div>
    </div>
  `;

  const d = new Dialog({
    title: `Shop: ${vendorActor.name}`,
    content: html,
    buttons: { close: { label: "Close" } },
    render: (dlgHtml) => {
      dlgHtml.find("button.eq5e-buy").on("click", async (ev) => {
        const id = ev.currentTarget.dataset.id;
        const item = vendorActor.items.get(id);
        await requestVendorBuy({ buyer, vendor: vendorActor, vendorItem: item, quantity: 1 });
      });
      dlgHtml.find("button.eq5e-sell").on("click", async (ev) => {
        const id = ev.currentTarget.dataset.id;
        const item = buyer.items.get(id);
        await requestVendorSell({ seller: buyer, vendor: vendorActor, sellerItem: item, quantity: 1 });
      });
    }
  });
  d.render(true);
}

function renderVendorPanel(app, html, data) {
  const actor = app?.actor;
  const v = actor?.flags?.eq5e?.vendor;
  if (!v) return;

  const next = v.nextRestockAt ? new Date(v.nextRestockAt).toLocaleString() : "Ready";
  const ready = canRestockVendorNow(actor);
  const tier = v.tier ?? 1;
  const shop = v.shop ?? "general";
  const flavor = v.flavor ?? "neutral";

  const panel = $(`
    <section class="eq5e-vendor-panel" style="border:1px solid var(--color-border-light-2); border-radius:8px; padding:8px; margin:8px 0;">
      <header style="display:flex; align-items:center; justify-content:space-between; gap:8px;">
        <div>
          <div style="font-weight:700;">EQ5e Vendor</div>
          <div style="opacity:0.85; font-size:0.9em;">Tier T${tier} • ${shop} • ${flavor}</div>
          <div style="opacity:0.8; font-size:0.85em;">Next restock: ${next}</div>
              <div style="opacity:0.8; font-size:0.85em;">Markup: ${(game.settings?.get?.("eq5e","vendorMarkup") ?? 1.2)}× • Buyback: ${(game.settings?.get?.("eq5e","vendorBuyback") ?? 0.4)}×</div>
        </div>
        <div style="display:flex; gap:6px; align-items:center;">
          <button type="button" class="eq5e-vendor-shop" title="Open shop">Shop</button>
              <button type="button" class="eq5e-vendor-restock" ${ready ? "" : ""} title="Restock this vendor (GM)">Restock</button>
          <button type="button" class="eq5e-vendor-restock-force" title="Force restock (GM)">Force</button>
        </div>
      </header>
<div class="eq5e-vendor-stock-preview" style="margin-top:8px; max-height:160px; overflow:auto;">
  <div style="font-weight:600; margin-bottom:4px;">Stock (preview)</div>
  <table style="width:100%; font-size:0.9em;">
    <thead><tr><th style="text-align:left;">Item</th><th style="text-align:right;">Qty</th><th style="text-align:right;">Buy</th><th style="text-align:right;">Buyback</th><th style="text-align:right;">Quality</th></tr></thead>
    <tbody>
      ${actor.items.filter(i=>i.flags?.eq5e?.vendorItem).slice(0,12).map(i=>{
        const qty = Number(i.system?.eq5e?.quantity ?? 1)||1;
        const buy = formatPrice(previewSellCP(i));
        const bb = formatPrice(previewBuybackCP(i));
        const q = i.flags?.eq5e?.quality ?? "standard";
        const c = i.flags?.eq5e?.condition ?? "mint";
        return `<tr><td>${i.name}</td><td style="text-align:right;">${qty}</td><td style="text-align:right;">${buy}</td><td style="text-align:right;">${bb}</td><td style="text-align:right;">${formatQuality(q,c)}</td></tr>`;
      }).join("")}
    </tbody>
  </table>
  ${actor.items.filter(i=>i.flags?.eq5e?.vendorItem).length>12 ? `<div style="opacity:0.75; font-size:0.85em; margin-top:4px;">…and more</div>` : ""}
</div>
    </section>
  `);

  const body = html.find(".sheet-body");
  if (body.length) body.prepend(panel);
  else html.prepend(panel);

  panel.find(".eq5e-vendor-shop").on("click", async () => openVendorShopDialog(actor));
      panel.find(".eq5e-vendor-restock").on("click", async () => restockVendor(actor, {force:false}));
  panel.find(".eq5e-vendor-restock-force").on("click", async () => restockVendor(actor, {force:true}));
}

async function ensureVendorFolder() {
  // Create (or find) a folder for vendors to keep things tidy
  const name = "EQ5e Vendors";
  const existing = game.folders?.find?.(f => f.type === "Actor" && f.name === name);
  if (existing) return existing;
  if (!game.user.isGM) return null;
  return Folder.create({name, type: "Actor"});
}

async function ensureVendorActor({name, tier, shop, flavor}) {
  // Creates or reuses an NPC actor to hold inventory
  const folder = await ensureVendorFolder();
  let actor = game.actors?.getName?.(name) ?? null;
  if (!actor && game.user.isGM) {
    actor = await Actor.create({
      name,
      type: "npc",
      folder: folder?.id ?? null,
      flags: { eq5e: { vendor: { tier, shop, flavor, count: 18, nextRestockAt: 0 } } }
    });
  }
  return actor;
}

function flavorProfile(flavor) {
  // Light-touch “local flavor” that nudges inventory, not hard-gates it.
  // You can add more later without breaking anything.
  const f = (flavor || "neutral").toLowerCase();
  const profiles = {
    neutral: { preferSkills: [], preferArmor: [], preferEtched: 0.25 },
    human:   { preferSkills: ["slash","blunt"], preferArmor: ["chain","plate"], preferEtched: 0.20 },
    dwarf:   { preferSkills: ["blunt","2hblunt"], preferArmor: ["chain","plate"], preferEtched: 0.10 },
    elf:     { preferSkills: ["pierce","archery","2hpierce"], preferArmor: ["leather","chain"], preferEtched: 0.35 },
    darkelf: { preferSkills: ["pierce","slash"], preferArmor: ["leather","chain"], preferEtched: 0.45 },
    iksar:   { preferSkills: ["2hpierce","slash"], preferArmor: ["leather","chain"], preferEtched: 0.15 },
    ogre:    { preferSkills: ["2hblunt","2hslash","blunt"], preferArmor: ["plate","chain"], preferEtched: 0.10 },
    troll:   { preferSkills: ["2hblunt","2hslash","slash"], preferArmor: ["chain","plate"], preferEtched: 0.05 }
  };
  return profiles[f] ?? profiles.neutral;
}

function flavorScore(item, profile) {
  // Returns multiplier (>=0). We accept items probabilistically to nudge selection.
  const tags = item?.flags?.eq5e?.tags ?? [];
  const weaponSkill = item?.system?.eq5e?.weapon?.skill;
  const armorType = item?.system?.eq5e?.armor?.armorType;
  let mult = 1.0;

  if (weaponSkill && profile.preferSkills?.includes(weaponSkill)) mult *= 1.35;
  if (armorType && profile.preferArmor?.includes(armorType)) mult *= 1.25;

  // Skin preference: some locales stock more “etched” variants
  const nm = (item?.name || "").toLowerCase();
  const isEtched = nm.includes("(etched)");
  if (isEtched) mult *= (1.0 + profile.preferEtched);
  else mult *= (1.0 - (profile.preferEtched * 0.25));

  // Avoid weird extremes
  return Math.max(0.25, Math.min(1.9, mult));
}

async function persistVendorInventoryToActor(actor, rows, {clearExisting=true}={}) {
  if (!actor) return;
  if (!game.user.isGM) {
    ui.notifications?.warn?.("EQ5e: Only the GM can persist vendor inventory to an actor.");
    return;
  }

  // Mark items we create so we can cleanly refresh later
  const vendorFlagKey = "eq5e.vendorItem";

  if (clearExisting) {
    const toDelete = actor.items.filter(i => i.flags?.eq5e?.vendorItem);
    if (toDelete.length) await actor.deleteEmbeddedDocuments("Item", toDelete.map(i => i.id));
  }

  const toCreate = [];
  for (const r of rows) {
    const doc = r.uuid ? await fromUuid(r.uuid) : null;
    if (!doc) continue;
    const data = doc.toObject();
    // Ensure the embedded copy keeps price
    data.flags = data.flags || {};
    data.flags.eq5e = data.flags.eq5e || {};
    data.flags.eq5e.vendorItem = true;
    // Quantity hook (simple)
    data.system = data.system || {};
    data.system.eq5e = data.system.eq5e || {};
    data.system.eq5e.quantity = r.qty ?? 1;
    toCreate.push(data);
  }

  if (toCreate.length) await actor.createEmbeddedDocuments("Item", toCreate);
}

async function generateVendorInventory({tier=1, shop="general", count=12, budgetCP=null, flavor="neutral", persist=false, actorName=null}={}) {
  tier = Math.max(1, Math.min(12, Number(tier)||1));
  count = Math.max(1, Math.min(80, Number(count)||12));

  const map = {
    general: "General Store",
    blacksmith: "Blacksmith",
    armorer: "Armorer",
    fletcher: "Fletcher",
    jeweler: "Jeweler"
  };
  const shopName = map[shop] ?? "General Store";
  const tableName = `EQ5e Vendor – ${shopName} (T${tier})`;

  const pack = game.packs.get(PACKS.vendors.collection);
  if (!pack) return ui.notifications?.warn?.("EQ5e vendor tables not found (import items first).");

  const docs = await pack.getDocuments();
  const table = docs.find(t => t.name === tableName);
  if (!table) return ui.notifications?.warn?.(`Vendor table not found: ${tableName}`);

  // Flavor nudges selection
  const fp = flavorProfile(flavor);

  // Draw results until count/budget reached
  let remaining = count;
  let total = 0;
  const rows = [];

  const cap = budgetCP ?? vendorPriceCapCP(tier, shop);

  // Guard against infinite loops on tight budgets
  let safety = count * 10;

  while (remaining > 0 && safety-- > 0) {
    const draw = await table.draw({displayChat:false});
    const r = draw?.results?.[0];
    if (!r) break;

    const uuid = r.documentCollection && r.documentId ? `Compendium.${r.documentCollection}.${r.documentId}` : null;
    let item = null;
    if (uuid) item = await fromUuid(uuid);
    if (!item) continue;

    // flavor accept/reject
    const mult = flavorScore(item, fp);
    if (Math.random() > (mult / 1.9)) continue;

    const cp = priceCPFromItem(item);
    if ((total + cp) > cap) continue;

    total += cp;
    rows.push({name: item.name, price: formatPrice(cp), uuid, qty: 1});
    remaining--;
  }

  const title = actorName ?? `Vendor: ${shopName} (T${tier})`;
  const html = [
    `<h2>${title}</h2>`,
    `<p><b>Flavor:</b> ${flavor} &nbsp; <b>Budget:</b> ${formatPrice(cap)} &nbsp; <b>Used:</b> ${formatPrice(total)}</p>`,
    `<ol>`,
    ...rows.map(r => `<li>${r.name} — <b>${r.price}</b></li>`),
    `</ol>`,
    `<p style="opacity:0.8">Tip: Persist to actor with <code>persist:true</code> (GM only).</p>`
  ].join("\n");

  ChatMessage.create({content: html, whisper: game.user.isGM ? [] : undefined});

  // Persist inventory to an Actor (GM)
  if (persist) {
    const actor = await ensureVendorActor({name: title, tier, shop, flavor});
    await actor.setFlag("eq5e", "vendor.tier", tier);
    await actor.setFlag("eq5e", "vendor.shop", shop);
    await actor.setFlag("eq5e", "vendor.flavor", flavor);
    await actor.setFlag("eq5e", "vendor.count", count);
    if (!(actor.flags?.eq5e?.vendor?.nextRestockAt)) await setNextRestock(actor);
    await persistVendorInventoryToActor(actor, rows, {clearExisting:true});
    ui.notifications?.info?.(`EQ5e Vendor persisted: ${title}`);
  }

  return {rows, totalCP: total, budgetCP: cap, actorName: title, flavor};
}

async function importCoreItemization({rebuildTables=true}={}) {
  if (!game.user.isGM) {
    ui.notifications?.warn?.("EQ5e: Only the GM can import core itemization.");
    return;
  }

  const base = _modulePath(MOD, "data");
  const data = {
    weapons: await fetchJSON(`${base}/weapons.json`),
    armor: await fetchJSON(`${base}/armor.json`),
    shields: await fetchJSON(`${base}/shields.json`),
    jewelry: await fetchJSON(`${base}/jewelry.json`),
    jewelryAC: await fetchJSON(`${base}/jewelry_ac_rare.json`),
    consum: await fetchJSON(`${base}/consumables.json`)
  };

  // Ensure packs
  const packs = {};
  for (const [k, v] of Object.entries(PACKS)) {
    packs[k] = await ensureWorldPack(v);
  }

  const r1 = await upsertPackItems(packs.weapons, data.weapons, { defaultType: PACKS.weapons.itemType });
  const r2 = await upsertPackItems(packs.armor, data.armor, { defaultType: PACKS.armor.itemType });
  const r3 = await upsertPackItems(packs.shields, data.shields, { defaultType: PACKS.shields.itemType });
  const r4 = await upsertPackItems(packs.jewelry, data.jewelry, { defaultType: PACKS.jewelry.itemType });
  const r5 = await upsertPackItems(packs.jewelryAC, data.jewelryAC, { defaultType: PACKS.jewelryAC.itemType });
  const r6 = await upsertPackItems(packs.consum, data.consum, { defaultType: PACKS.consum.itemType });

  if (rebuildTables) {
    await buildTieredLootTables(packs);
    await buildVendorTables(packs);
  }

  ui.notifications?.info?.(
    `EQ5e Core Items imported. Weapons +${r1.created}/${r1.updated}, Armor +${r2.created}/${r2.updated}, Shields +${r3.created}/${r3.updated}, Jewelry +${r4.created}/${r4.updated}, RareAC +${r5.created}/${r5.updated}, Consum +${r6.created}/${r6.updated}.`
  );
}

function rollLoot({tier=1, kind="trash"}={}) {
  tier = Math.max(1, Math.min(12, Number(tier)||1));
  const map = {trash:"Trash", named:"Named", boss:"Boss"};
  const k = map[kind] ?? "Trash";
  const tableName = `EQ5e Loot – ${k} (T${tier})`;
  const pack = game.packs.get(PACKS.loot.collection);
  if (!pack) return ui.notifications?.warn?.("EQ5e loot pack not found (import items first).");
  pack.getDocuments().then(docs => {
    const t = docs.find(x => x.name === tableName);
    if (!t) return ui.notifications?.warn?.(`Loot table not found: ${tableName}`);
    t.draw();
  });
}

Hooks.once("init", () => {
try {
  game.settings.register("eq5e", "vendorPriceCapCP", {
    name: "Vendor price cap (cp)",
    hint: "Hard cap for vendor price tables in copper pieces (cp).",
    scope: "world",
    config: true,
    type: Number,
    default: 5000
  });
} catch (e) {}

  // Vendor settings
  game.settings.register("eq5e", "vendorRestockDays", { name: "EQ5e Vendor Restock Days", scope: "world", config: true, type: Number, default: 3 });
  game.settings.register("eq5e", "vendorMarkup", { name: "EQ5e Vendor Markup (Sell to Players)", scope: "world", config: true, type: Number, default: 1.20 });
  game.settings.register("eq5e", "vendorBuyback", { name: "EQ5e Vendor Buyback (Buy from Players)", scope: "world", config: true, type: Number, default: 0.40 });
  game.settings.register("eq5e", "vendorsInfiniteFunds", { name: "EQ5e Vendors Have Infinite Funds", scope: "world", config: true, type: Boolean, default: true });
  game.settings.register("eq5e", "vendorRestockRefillCoin", { name: "EQ5e Vendor Restock Refills Coin Purse", scope: "world", config: true, type: Boolean, default: false });
  game.settings.register("eq5e", "vendorRestockRefillPctOfBudget", { name: "EQ5e Vendor Restock Coin Refill (% of tier budget)", scope: "world", config: true, type: Number, default: 0.60 });

  game.eq5e = game.eq5e || {};
  game.eq5e.itemization = game.eq5e.itemization || {};
  game.eq5e.itemization.importCore = importCoreItemization;
  game.eq5e.itemization.rollLoot = rollLoot;
  game.eq5e.itemization.generateVendorInventory = generateVendorInventory;
  game.eq5e.itemization.restockVendor = restockVendor;
  game.eq5e.itemization.vendorSellPriceCP = vendorSellPriceCP;
  game.eq5e.itemization.vendorBuybackPriceCP = vendorBuybackPriceCP;


  game.eq5e.itemization.priceCPFromItem = priceCPFromItem;
  game.eq5e.itemization.formatPrice = formatPrice;

});

// Optional: auto-import once when module is enabled in a fresh world
Hooks.once("ready", async () => {
  if (!game.user.isGM) return;
  const key = "coreItemizationImported";
  if (!game.settings.settings.has(`eq5e.${key}`)) {
    game.settings.register("eq5e", key, { name:"EQ5e Core Itemization Imported", scope:"world", config:false, type:Boolean, default:false });
  }
  const done = game.settings.get("eq5e", key);
  if (done) return;
  // Do not auto-run if world already has items; keep it conservative.
  await importCoreItemization({rebuildTables:true});
  await game.settings.set("eq5e", key, true);
});

Hooks.on("renderActorSheet", (app, html, data) => {
  try { renderVendorPanel(app, html, data); } catch (e) { console.warn("[EQ5e] vendor panel render failed", e); }
});
