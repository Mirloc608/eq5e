# EQ5e Getting Started

EQ5e is an EverQuest-inspired ruleset for Foundry VTT (v13) using D&D 5e as a guide. It focuses on **party combat**, **threat/aggro**, **crowd control**, and **mana pacing**.

## What to expect
- Tanks generate and maintain **threat**; damage alone does not guarantee aggro.
- Crowd control (mez/root/snare/slow/silence) is a core part of encounters.
- Pets are first-class actors with ownership controls and AI assistance.

## Your first session
1. Pick a class role: tank / healer / DPS / support / control.
2. Expect aggro to move if DPS or healing spikes.
3. Use CC to stabilize pulls.
4. Treat rotations as **assistive**: you still choose targets and timing.

## What is automated
- Threat tracking and displays
- Pet stance controls (assist/guard/passive)
- Rotation helpers (optional, deterministic)

## What is never automated
- GM rulings and encounter outcomes
- “AI deciding” whether you succeed
- Hidden dice fudging


## Core Equipment & Loot Tables

Enable **EQ5e – Core Itemization** (`eq5e-items-core`). On first GM load it will create world compendiums:

- `EQ5e Items – Weapons (Core)`
- `EQ5e Items – Armor (Core)`
- `EQ5e Items – Shields (Core)`
- `EQ5e Items – Jewelry (Core)`
- `EQ5e Items – Jewelry (AC Rare)` (very rare AC jewelry)
- `EQ5e Items – Consumables (Core)`
- `EQ5e Loot Tables (Core)`

Manual controls:
- `game.eq5e.itemization.importCore()` re-imports and rebuilds tables.
- `game.eq5e.itemization.rollLoot({tier: 4, kind: "named"})` draws from tiered tables.



## Vendor Tables

After enabling **EQ5e – Core Itemization**, the module will also create vendor RollTables per tier:

- `EQ5e Vendor – Blacksmith (T#)`
- `EQ5e Vendor – Armorer (T#)`
- `EQ5e Vendor – Fletcher (T#)`
- `EQ5e Vendor – Jeweler (T#)`
- `EQ5e Vendor – General Store (T#)`

Generate a “popular shop inventory” post in chat (GM):
```js
game.eq5e.itemization.generateVendorInventory({ tier: 3, shop: "blacksmith", count: 12 })
```
Shops: `general | blacksmith | armorer | fletcher | jeweler`


### Persistent vendor inventory + local flavor

Generate inventory and also persist it onto an NPC Actor (GM only):
```js
game.eq5e.itemization.generateVendorInventory({
  tier: 4,
  shop: "armorer",
  count: 18,
  flavor: "dwarf",
  persist: true,
  actorName: "Kaladim Armorer"
})
```

Flavors: `neutral | human | dwarf | elf | darkelf | iksar | ogre | troll`


## Merchant persistence, restock cadence, and pricing

**Persist inventory** (GM):
```js
game.eq5e.itemization.generateVendorInventory({
  tier: 4, shop: "armorer", count: 18, flavor: "dwarf",
  persist: true, actorName: "Kaladim Armorer"
})
```

**Restock** (GM):
- Open the vendor's sheet and click **Restock** / **Force**
- Or via API:
```js
game.eq5e.itemization.restockVendor(game.actors.getName("Kaladim Armorer"))
```

**Pricing helpers**:
```js
game.eq5e.itemization.vendorSellPriceCP(item)   // player buys from vendor (markup)
game.eq5e.itemization.vendorBuybackPriceCP(item) // vendor buys from player (buyback)
```

World settings (Configure Settings → System Settings):
- `EQ5e Vendor Restock Days`
- `EQ5e Vendor Markup (Sell to Players)`
- `EQ5e Vendor Buyback (Buy from Players)`


## Buying and selling with merchants

Vendor sheets now include a **Shop** button (players can click it) which opens a buy/sell dialog.

Transactions are **GM-authoritative** via the existing `system.eq5e` socket channel.

Currency is tracked as `eq5e.currency.cp` on the character (flag-based for now).

You can also trigger buys/sells via socket manually (advanced):
```js
game.socket.emit("system.eq5e", { type:"eq5e.vendorBuy", userId: game.user.id, buyerActorUuid: game.user.character.uuid, vendorActorUuid: vendor.uuid, vendorItemId: vendor.items.contents[0].id, quantity: 1 })
```


## Vendor shop (Buy/Sell)

Open a vendor NPC (one created via the vendor inventory generator) and click **Shop**.

- Buy 1 / Buy X uses the Qty field.
- Sell 1 / Sell X / Sell All are stack-aware (`system.eq5e.quantity`).
- Optional: disable infinite vendor funds in System Settings to enforce coin purses.


## Vendor item quality/condition

Items sold to vendors are tagged:
- `flags.eq5e.condition` (used|mint)
- `flags.eq5e.quality` (worn|standard|fine|exquisite)

Vendors use these tags when computing buy/sell prices. The vendor sheet shows a stock preview with computed prices.
