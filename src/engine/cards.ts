import type { Card, CardDef, GuestType } from './types';

/**
 * Pocket francs by rank.
 * Rank 2 = 18F and rank 3 = 26F are verified from 2017 EN card art.
 * Rank 0 = 4F and rank 1 = 10F are a documented teaching-app assumption
 * (unverified on physical cards; rank 2/3 match sampled 2017 EN art).
 */
export const POCKET_BY_RANK = [4, 10, 18, 26] as const;

/**
 * Occupation copy counts are not printed in the rulebook.
 * 14 of each traveler type is the only even split of 70 travelers (Carnies
 * confirms 14 nobles). Within a type we use 3 / 3 / 2 / 2 / 2 / 2 for the
 * six occupations (ranks 0, 1, 2, and three rank-3s).
 * Police: Peacekeeper / Brigadier / Chief Brigadier plus generic "Police"
 * of matching ranks to fill 14.
 */
function d(
  occupationId: string,
  name: string,
  type: GuestType,
  rank: 0 | 1 | 2 | 3,
  annex: CardDef['annex'],
  affinity: CardDef['affinity'],
): CardDef {
  return {
    occupationId,
    name,
    type,
    rank,
    pocket: POCKET_BY_RANK[rank],
    annex,
    affinity,
  };
}

export const DEFS: Record<string, CardDef> = {
  cultivator: d('cultivator', 'Cultivator', 'artisan', 0, { id: 'vegetableGarden', name: 'Vegetable Garden' }, 'build'),
  mechanic: d('mechanic', 'Mechanic', 'artisan', 1, { id: 'workshop', name: 'Workshop' }, 'build'),
  distiller: d('distiller', 'Distiller', 'artisan', 2, { id: 'distillery', name: 'Distillery' }, 'build'),
  gardener: d('gardener', 'Gardener', 'artisan', 3, { id: 'gardens', name: 'Gardens' }, 'build'),
  landscaper: d('landscaper', 'Landscaper', 'artisan', 3, { id: 'park', name: 'Park' }, 'build'),
  butcher: d('butcher', 'Butcher', 'artisan', 3, { id: 'butcherShop', name: 'Butcher Shop' }, 'build'),

  newsboy: d('newsboy', 'Newsboy', 'merchant', 0, { id: 'kiosk', name: 'Kiosk' }, 'bribe'),
  representative: d('representative', 'Representative', 'merchant', 1, { id: 'parlor', name: 'Parlor' }, 'bribe'),
  concierge: d('concierge', 'Concierge', 'merchant', 2, { id: 'roomService', name: 'Room Service' }, 'bribe'),
  grocer: d('grocer', 'Grocer', 'merchant', 3, { id: 'grocery', name: 'Grocery' }, 'bribe'),
  shopkeeper: d('shopkeeper', 'Shopkeeper', 'merchant', 3, { id: 'shop', name: 'Shop' }, 'bribe'),
  brewer: d('brewer', 'Brewer', 'merchant', 3, { id: 'brewery', name: 'Brewery' }, 'bribe'),

  novice: d('novice', 'Novice', 'religious', 0, { id: 'altar', name: 'Altar' }, 'bury'),
  monk: d('monk', 'Monk', 'religious', 1, { id: 'bedroom', name: 'Bedroom' }, 'bury'),
  abbot: d('abbot', 'Abbot', 'religious', 2, { id: 'cellar', name: 'Cellar' }, 'bury'),
  priest: d('priest', 'Priest', 'religious', 3, { id: 'chapel', name: 'Chapel' }, 'bury'),
  archbishop: d('archbishop', 'Archbishop', 'religious', 3, { id: 'crypt', name: 'Crypt' }, 'bury'),
  bishop: d('bishop', 'Bishop', 'religious', 3, { id: 'bishopric', name: 'Bishopric' }, 'bury'),

  baron: d('baron', 'Baron', 'noble', 0, { id: 'chandelier', name: 'Grand Chandelier' }, null),
  viscount: d('viscount', 'Viscount', 'noble', 1, { id: 'kingSizeBed', name: 'King Size Bed' }, null),
  count: d('count', 'Count', 'noble', 2, { id: 'diningRoom', name: 'Dining Room' }, null),
  duke: d('duke', 'Duke', 'noble', 3, { id: 'stables', name: 'Stables' }, null),
  prince: d('prince', 'Prince', 'noble', 3, { id: 'greenhouse', name: 'Greenhouse' }, null),
  marquis: d('marquis', 'Marquis', 'noble', 3, { id: 'pavilion', name: 'Pavilion' }, null),

  peacekeeper: d('peacekeeper', 'Peacekeeper', 'police', 0, null, 'kill'),
  brigadier: d('brigadier', 'Brigadier', 'police', 1, null, 'kill'),
  chiefBrigadier: d('chiefBrigadier', 'Chief Brigadier', 'police', 2, null, 'kill'),
  police: d('police', 'Police', 'police', 3, null, 'kill'),

  peasant: d('peasant', 'Peasant', 'peasant', 0, null, null),
};

/** Copies of each occupation. Peasants are 8 total, dealt at setup, never shuffled into the entrance. */
export const COPY_COUNTS: Record<string, number> = {
  cultivator: 3, mechanic: 3, distiller: 2, gardener: 2, landscaper: 2, butcher: 2,
  newsboy: 3, representative: 3, concierge: 2, grocer: 2, shopkeeper: 2, brewer: 2,
  novice: 3, monk: 3, abbot: 2, priest: 2, archbishop: 2, bishop: 2,
  baron: 3, viscount: 3, count: 2, duke: 2, prince: 2, marquis: 2,
  peacekeeper: 4, brigadier: 4, chiefBrigadier: 3, police: 3,
  peasant: 8,
};

export function defOf(card: Card): CardDef {
  const dfn = DEFS[card.occupationId];
  if (!dfn) throw new Error(`Unknown occupation ${card.occupationId}`);
  return dfn;
}

export function typeColor(type: GuestType): string {
  switch (type) {
    case 'merchant':
      return '#3a6ea5';
    case 'artisan':
      return '#a33b32';
    case 'police':
      return '#6a6e74';
    case 'religious':
      return '#6b4c9a';
    case 'noble':
      return '#2f7a4f';
    case 'peasant':
      return '#c4a035';
  }
}

export function affinityLabel(a: CardDef['affinity']): string {
  if (a === 'bribe') return 'Bribe';
  if (a === 'build') return 'Build';
  if (a === 'kill') return 'Kill';
  if (a === 'bury') return 'Bury';
  return '—';
}

export function buildTravelerDeck(): Card[] {
  const cards: Card[] = [];
  for (const [id, count] of Object.entries(COPY_COUNTS)) {
    if (id === 'peasant') continue;
    for (let i = 0; i < count; i++) {
      cards.push({ uid: `${id}-${i}`, occupationId: id });
    }
  }
  return cards;
}

export function buildPeasants(): Card[] {
  const n = COPY_COUNTS.peasant;
  const cards: Card[] = [];
  for (let i = 0; i < n; i++) {
    cards.push({ uid: `peasant-${i}`, occupationId: 'peasant' });
  }
  return cards;
}

export const TRAVELER_TYPE_COUNT = 14;
