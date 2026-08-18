/**
 * First-class water-policy topics.
 *
 * These are Rising Tide's own editorial categories — they are NOT supplied by
 * LegiScan or New York State. Descriptions live here (not in the database and
 * not generated at request time) so they can be reviewed like any other content.
 */

export interface TopicDefinition {
  slug: string;
  name: string;
  /** One or two plain sentences a 15-year-old can read. */
  shortDescription: string;
  /** Fuller explanation shown on the topic page. */
  longDescription: string;
  category: 'Water we drink' | 'Pollution' | 'Coasts & oceans' | 'Ecosystems' | 'Infrastructure & climate';
  sortOrder: number;
  /** Slugs of topics that are useful to explore next. */
  related: string[];
}

export const TOPICS = [
  {
    slug: 'drinking-water',
    name: 'Drinking Water',
    shortDescription:
      'The water that comes out of the tap — where it comes from, how it is tested, and who pays to keep it safe.',
    longDescription:
      'Roughly nine million New Yorkers drink water from public systems supplied by upstate reservoirs, and millions more rely on wells and smaller local systems. Legislation in this topic covers testing requirements, contaminant limits, notification when something is found, help for households on private wells, and the cost of keeping treatment systems running.',
    category: 'Water we drink',
    sortOrder: 10,
    related: ['pfas-contaminants', 'groundwater', 'water-infrastructure'],
  },
  {
    slug: 'water-quality',
    name: 'Water Quality',
    shortDescription:
      'Rules about what may be released into New York waters, and how clean lakes, rivers and bays have to be.',
    longDescription:
      'Water quality law sets the standards a waterbody has to meet and the permits a facility needs before discharging anything into it. Bills here often adjust pollutant limits, monitoring and public reporting, or the consequences when a waterbody fails to meet its standard.',
    category: 'Pollution',
    sortOrder: 20,
    related: ['pfas-contaminants', 'wastewater-sewage', 'stormwater'],
  },
  {
    slug: 'pfas-contaminants',
    name: 'PFAS & Contaminants',
    shortDescription:
      'PFAS "forever chemicals", lead, and other emerging contaminants that show up in water supplies.',
    longDescription:
      'PFAS are a family of synthetic chemicals used in firefighting foam, packaging and stain resistant products. They break down extremely slowly, which is why they are often called forever chemicals. This topic also covers lead service lines and other contaminants that regulators have only recently begun setting limits for.',
    category: 'Pollution',
    sortOrder: 30,
    related: ['drinking-water', 'groundwater', 'water-quality'],
  },
  {
    slug: 'wastewater-sewage',
    name: 'Wastewater & Sewage',
    shortDescription:
      'What happens to water after it goes down the drain, and what happens when treatment systems overflow.',
    longDescription:
      'Many New York communities use combined sewers that carry both sewage and rain runoff. During heavy storms these systems overflow directly into rivers and harbors. Legislation here covers treatment plant upgrades, overflow reporting, septic system replacement, and funding for local sewer districts.',
    category: 'Pollution',
    sortOrder: 40,
    related: ['stormwater', 'water-infrastructure', 'water-quality'],
  },
  {
    slug: 'stormwater',
    name: 'Stormwater',
    shortDescription:
      'Rain that runs off streets and rooftops, picking up pollution before it reaches a stream or bay.',
    longDescription:
      'Stormwater is the largest source of pollution that does not come out of a single pipe, which is why it is called nonpoint source pollution. Bills in this topic address runoff permits, green infrastructure that lets water soak into the ground, and erosion and sediment control at construction sites.',
    category: 'Pollution',
    sortOrder: 50,
    related: ['wastewater-sewage', 'flooding-resilience', 'water-quality'],
  },
  {
    slug: 'oceans-coasts',
    name: 'Oceans & Coasts',
    shortDescription:
      'New York\u2019s ocean shoreline, beaches, harbors and the marine life that depends on them.',
    longDescription:
      'New York has roughly 2,600 miles of coastline once bays and inlets are counted. This topic covers coastal zone management, beach water quality and closures, offshore activity, marine protected species, and the working waterfronts that coastal communities depend on.',
    category: 'Coasts & oceans',
    sortOrder: 60,
    related: ['long-island-sound', 'flooding-resilience', 'plastics-marine-debris'],
  },
  {
    slug: 'long-island-sound',
    name: 'Long Island Sound',
    shortDescription:
      'The estuary between Long Island and Connecticut, shared by two states and millions of people.',
    longDescription:
      'Long Island Sound is an estuary — a place where fresh water from rivers mixes with salt water from the ocean. Low oxygen conditions caused by excess nitrogen have been a long standing problem. Legislation often deals with nitrogen reduction, shellfish restoration and shared management with Connecticut.',
    category: 'Coasts & oceans',
    sortOrder: 70,
    related: ['oceans-coasts', 'aquatic-ecosystems', 'wastewater-sewage'],
  },
  {
    slug: 'great-lakes',
    name: 'Great Lakes',
    shortDescription:
      'Lake Erie, Lake Ontario and their connecting waters along New York\u2019s western and northern edge.',
    longDescription:
      'The Great Lakes hold about one fifth of the world\u2019s surface fresh water. New York borders two of them. Bills here address invasive species, harmful algal blooms, shoreline erosion from changing lake levels, and cooperation with other Great Lakes states.',
    category: 'Coasts & oceans',
    sortOrder: 80,
    related: ['watersheds-rivers', 'aquatic-ecosystems', 'water-quality'],
  },
  {
    slug: 'wetlands',
    name: 'Wetlands',
    shortDescription:
      'Marshes and swamps that filter pollution, absorb floodwater and shelter young fish and birds.',
    longDescription:
      'Wetlands do expensive work for free: they slow floodwaters, trap sediment and pollutants, and serve as nurseries for wildlife. New York regulates freshwater and tidal wetlands separately. Legislation frequently concerns which wetlands are protected, mapping requirements, and permits for building near them.',
    category: 'Ecosystems',
    sortOrder: 90,
    related: ['flooding-resilience', 'aquatic-ecosystems', 'watersheds-rivers'],
  },
  {
    slug: 'flooding-resilience',
    name: 'Flooding & Resilience',
    shortDescription:
      'Rising seas, heavier storms, and how communities prepare for water where it is not wanted.',
    longDescription:
      'Flood risk in New York comes from coastal storm surge, rivers overtopping their banks, and rainfall that overwhelms drainage. Resilience legislation covers floodplain mapping and building rules, buyouts of repeatedly flooded property, shoreline protection, and planning for sea level rise.',
    category: 'Infrastructure & climate',
    sortOrder: 100,
    related: ['oceans-coasts', 'stormwater', 'wetlands'],
  },
  {
    slug: 'watersheds-rivers',
    name: 'Watersheds & Rivers',
    shortDescription:
      'Rivers, streams and the land areas that drain into them, including the watersheds that supply New York City.',
    longDescription:
      'A watershed is all the land that drains into one body of water, so what happens on land upstream determines water quality downstream. This topic covers river protection, streambank and corridor management, dam and culvert issues, and the upstate watersheds that supply drinking water to millions.',
    category: 'Ecosystems',
    sortOrder: 110,
    related: ['drinking-water', 'aquatic-ecosystems', 'water-infrastructure'],
  },
  {
    slug: 'aquatic-ecosystems',
    name: 'Aquatic Ecosystems',
    shortDescription:
      'The plants, animals and habitats that live in and depend on New York waters.',
    longDescription:
      'Aquatic ecosystems include everything from oyster reefs and eelgrass beds to cold water trout streams. Legislation here addresses habitat restoration, invasive species, fish passage past dams, and protection of species that depend on healthy water.',
    category: 'Ecosystems',
    sortOrder: 120,
    related: ['fisheries', 'wetlands', 'watersheds-rivers'],
  },
  {
    slug: 'fisheries',
    name: 'Fisheries',
    shortDescription:
      'Commercial and recreational fishing, shellfish beds, and the rules that keep fish populations from collapsing.',
    longDescription:
      'Fisheries management balances the people who fish for a living, people who fish for recreation, and the long term survival of the population itself. Bills in this topic cover catch limits and seasons, shellfish harvesting and aquaculture, hatcheries, and licensing.',
    category: 'Ecosystems',
    sortOrder: 130,
    related: ['aquatic-ecosystems', 'oceans-coasts', 'long-island-sound'],
  },
  {
    slug: 'water-infrastructure',
    name: 'Water Infrastructure',
    shortDescription:
      'The pipes, plants, dams and culverts that move and treat water — much of it a century old.',
    longDescription:
      'Water infrastructure is largely invisible until it fails. This topic covers state grant and loan programs for local water projects, water main replacement, dam safety, culvert sizing, and how water utilities set rates and recover costs.',
    category: 'Infrastructure & climate',
    sortOrder: 140,
    related: ['drinking-water', 'wastewater-sewage', 'flooding-resilience'],
  },
  {
    slug: 'groundwater',
    name: 'Groundwater',
    shortDescription:
      'Water stored underground in aquifers — the only drinking water source for most of Long Island.',
    longDescription:
      'Groundwater sits in porous rock and sand below the surface. Long Island depends on a sole source aquifer, meaning there is no backup supply. Because groundwater moves slowly, contamination can persist for decades. Bills here cover well testing, withdrawal limits, and protection of recharge areas.',
    category: 'Water we drink',
    sortOrder: 150,
    related: ['drinking-water', 'pfas-contaminants', 'wetlands'],
  },
  {
    slug: 'plastics-marine-debris',
    name: 'Plastics & Marine Debris',
    shortDescription:
      'Plastic waste and microplastics that end up in waterways, beaches and the food chain.',
    longDescription:
      'Plastic does not biodegrade; it breaks into smaller and smaller fragments called microplastics that have been found in fish, shellfish and drinking water. Legislation in this topic includes packaging and single-use plastic rules, balloon and foam restrictions, and cleanup programs.',
    category: 'Pollution',
    sortOrder: 160,
    related: ['oceans-coasts', 'water-quality', 'aquatic-ecosystems'],
  },
] as const satisfies readonly TopicDefinition[];

export type TopicSlug = (typeof TOPICS)[number]['slug'];

export const TOPIC_SLUGS: TopicSlug[] = TOPICS.map((t) => t.slug);

const TOPIC_BY_SLUG = new Map<string, TopicDefinition>(TOPICS.map((t) => [t.slug, t]));

export function getTopicDefinition(slug: string): TopicDefinition | undefined {
  return TOPIC_BY_SLUG.get(slug);
}

export function isTopicSlug(value: string): value is TopicSlug {
  return TOPIC_BY_SLUG.has(value);
}

export const TOPIC_CATEGORIES = [
  'Coasts & oceans',
  'Ecosystems',
  'Infrastructure & climate',
  'Pollution',
  'Water we drink',
] as const;
