/**
 * The single readable definition of "what counts as New York water policy".
 *
 * Two jobs live here:
 *   1. DISCOVERY  — the LegiScan full-text queries that produce a candidate pool.
 *   2. CLASSIFICATION — the weighted concepts that decide whether a candidate is
 *      actually about water, and which topics it belongs to.
 *
 * LegiScan full-text query syntax used below (per legiscan.com/fulltext-search):
 *   "quoted phrase"   exact phrase
 *   AND / OR / NOT    boolean logic
 *   ( )               precedence
 *   ADJ / NEAR        proximity
 */

import type { TopicSlug } from './topics';

/* ------------------------------------------------------------------------- */
/* Concept model                                                              */
/* ------------------------------------------------------------------------- */

/**
 * How strongly a matched phrase implies the bill is about water policy.
 *  core     — unambiguous water-policy language ("combined sewer overflow")
 *  strong   — almost always water related in a legislative context ("watershed")
 *  moderate — water related but also used in other contexts ("flooding", "runoff")
 *  generic  — a bare word that alone proves nothing ("water", "bay")
 */
export type ConceptTier = 'core' | 'strong' | 'moderate' | 'generic';

export interface WaterConcept {
  id: string;
  /** Human phrasing used in reader-facing explanations. */
  label: string;
  tier: ConceptTier;
  /** Lowercase phrases; matched on word boundaries, never as substrings. */
  terms: string[];
  topics: TopicSlug[];
}

/** Base points awarded the first time a concept of each tier is seen. */
export const TIER_WEIGHTS: Record<ConceptTier, number> = {
  core: 12,
  strong: 8,
  moderate: 5,
  generic: 2,
};

/**
 * Where the phrase was found matters far more than how often.
 * A title match is the strongest signal available without reading the bill.
 */
export const FIELD_MULTIPLIERS = {
  title: 3,
  description: 2,
  subjects: 2.5,
  committee: 1,
  text: 0.5,
} as const;

export type EvidenceField = keyof typeof FIELD_MULTIPLIERS;

/** A named New York waterbody is close to proof of relevance on its own. */
export const WATER_BODY_WEIGHT = 9;

/* ------------------------------------------------------------------------- */
/* Concepts                                                                   */
/* ------------------------------------------------------------------------- */

export const WATER_CONCEPTS: WaterConcept[] = [
  /* --- Drinking water ---------------------------------------------------- */
  {
    id: 'drinking-water',
    label: 'drinking water',
    tier: 'core',
    terms: [
      'drinking water',
      'potable water',
      'public water supply',
      'public water system',
      'water supply system',
      'tap water',
      'bottled water',
    ],
    topics: ['drinking-water', 'water-quality'],
  },
  {
    id: 'lead-service-lines',
    label: 'lead in drinking water',
    tier: 'core',
    terms: ['lead service line', 'lead in drinking water', 'lead pipe', 'lead water line'],
    topics: ['drinking-water', 'pfas-contaminants', 'water-infrastructure'],
  },
  {
    id: 'water-testing',
    label: 'water testing requirements',
    tier: 'core',
    terms: [
      'water testing',
      'water quality testing',
      'well water testing',
      'maximum contaminant level',
      'notification level',
    ],
    topics: ['drinking-water', 'water-quality'],
  },

  /* --- Contaminants ------------------------------------------------------ */
  {
    id: 'pfas',
    label: 'PFAS and other emerging contaminants',
    tier: 'core',
    terms: [
      'pfas',
      'pfoa',
      'pfos',
      'perfluoroalkyl',
      'polyfluoroalkyl',
      'forever chemical',
      'forever chemicals',
      'emerging contaminant',
      'emerging contaminants',
      '1,4-dioxane',
      'firefighting foam',
    ],
    topics: ['pfas-contaminants', 'drinking-water', 'water-quality'],
  },
  {
    id: 'water-contamination',
    label: 'water contamination',
    tier: 'core',
    terms: [
      'water contamination',
      'contaminated water',
      'groundwater contamination',
      'water pollution',
      'toxic discharge',
    ],
    topics: ['water-quality', 'pfas-contaminants'],
  },
  {
    id: 'harmful-algal-blooms',
    label: 'harmful algal blooms',
    tier: 'core',
    terms: [
      'harmful algal bloom',
      'harmful algal blooms',
      'algal bloom',
      'algae bloom',
      'cyanobacteria',
      'blue-green algae',
      'eutrophication',
    ],
    topics: ['water-quality', 'aquatic-ecosystems'],
  },
  {
    id: 'nutrient-pollution',
    label: 'nutrient pollution',
    tier: 'core',
    terms: [
      'nutrient pollution',
      'nitrogen pollution',
      'nitrogen loading',
      'phosphorus runoff',
      'fertilizer runoff',
    ],
    topics: ['water-quality', 'long-island-sound'],
  },
  {
    id: 'microplastics',
    label: 'plastics and marine debris',
    tier: 'core',
    terms: [
      'microplastic',
      'microplastics',
      'marine debris',
      'plastic pollution',
      'microbead',
      'microbeads',
      'single-use plastic',
      'single use plastic',
      'balloon release',
    ],
    topics: ['plastics-marine-debris', 'oceans-coasts'],
  },

  /* --- Water quality regulation ------------------------------------------ */
  {
    id: 'water-quality-standards',
    label: 'water quality standards',
    tier: 'core',
    terms: [
      'water quality',
      'water quality standard',
      'water quality standards',
      'clean water act',
      'impaired water',
      'impaired waters',
      'total maximum daily load',
    ],
    topics: ['water-quality'],
  },
  {
    id: 'discharge-permits',
    label: 'discharge permits',
    tier: 'strong',
    terms: [
      'effluent',
      'discharge permit',
      'spdes',
      'npdes',
      'point source',
      'pollutant discharge',
      'outfall',
    ],
    topics: ['water-quality', 'wastewater-sewage'],
  },

  /* --- Wastewater and stormwater ----------------------------------------- */
  {
    id: 'combined-sewer-overflow',
    label: 'sewage overflows',
    tier: 'core',
    terms: [
      'combined sewer overflow',
      'sanitary sewer overflow',
      'sewage discharge',
      'raw sewage',
      'sewage overflow',
      'sewage spill',
    ],
    topics: ['wastewater-sewage', 'water-quality'],
  },
  {
    id: 'wastewater-treatment',
    label: 'wastewater treatment',
    tier: 'core',
    terms: [
      'wastewater treatment',
      'waste water treatment',
      'sewage treatment',
      'water pollution control plant',
      'publicly owned treatment works',
      'wastewater infrastructure',
    ],
    topics: ['wastewater-sewage', 'water-infrastructure'],
  },
  {
    id: 'septic',
    label: 'septic systems',
    tier: 'core',
    terms: ['septic system', 'septic tank', 'onsite wastewater', 'cesspool', 'cesspools'],
    topics: ['wastewater-sewage', 'groundwater'],
  },
  {
    id: 'sewer',
    label: 'sewer systems',
    tier: 'strong',
    terms: ['sewer district', 'sewer system', 'sanitary sewer', 'sewage', 'sewer main'],
    topics: ['wastewater-sewage'],
  },
  {
    id: 'stormwater',
    label: 'stormwater management',
    tier: 'core',
    terms: [
      'stormwater',
      'storm water',
      'nonpoint source',
      'non-point source',
      'green infrastructure',
      'permeable pavement',
    ],
    topics: ['stormwater', 'water-quality'],
  },
  {
    id: 'runoff',
    label: 'runoff and erosion',
    tier: 'moderate',
    terms: ['runoff', 'erosion control', 'sedimentation', 'sediment control'],
    topics: ['stormwater'],
  },

  /* --- Groundwater ------------------------------------------------------- */
  {
    id: 'groundwater',
    label: 'groundwater and aquifers',
    tier: 'core',
    terms: [
      'groundwater',
      'ground water',
      'aquifer',
      'aquifers',
      'sole source aquifer',
      'well water',
      'private well',
      'recharge area',
    ],
    topics: ['groundwater', 'drinking-water'],
  },

  /* --- Watersheds and rivers --------------------------------------------- */
  {
    id: 'watershed',
    label: 'watershed protection',
    tier: 'strong',
    terms: ['watershed', 'watersheds', 'sub-watershed', 'source water protection'],
    topics: ['watersheds-rivers', 'drinking-water'],
  },
  {
    id: 'riparian',
    label: 'streams and riverbanks',
    tier: 'strong',
    terms: [
      'riparian',
      'streambank',
      'stream corridor',
      'stream restoration',
      'navigable waters',
      'waters of the state',
      'protected stream',
    ],
    topics: ['watersheds-rivers', 'aquatic-ecosystems'],
  },
  {
    id: 'surface-water',
    label: 'surface and fresh water',
    tier: 'strong',
    terms: ['freshwater', 'fresh water', 'surface water', 'waterbody', 'water body'],
    topics: ['water-quality', 'watersheds-rivers'],
  },

  /* --- Wetlands ---------------------------------------------------------- */
  {
    id: 'wetlands',
    label: 'wetlands protection',
    tier: 'core',
    terms: [
      'wetland',
      'wetlands',
      'tidal wetlands',
      'freshwater wetlands',
      'wetland permit',
      'marshland',
      'salt marsh',
    ],
    topics: ['wetlands', 'aquatic-ecosystems'],
  },

  /* --- Coasts and oceans -------------------------------------------------- */
  {
    id: 'coastal-management',
    label: 'coastal management',
    tier: 'strong',
    terms: [
      'coastal zone',
      'coastal management',
      'coastal waters',
      'coastal area',
      'shoreline',
      'waterfront revitalization',
      'coastal community',
    ],
    topics: ['oceans-coasts'],
  },
  {
    id: 'ocean-marine',
    label: 'ocean and marine resources',
    tier: 'strong',
    terms: [
      'ocean',
      'oceans',
      'marine resources',
      'marine life',
      'marine mammal',
      'marine protected area',
      'ocean acidification',
      'offshore waters',
      'seagrass',
      'eelgrass',
    ],
    topics: ['oceans-coasts', 'aquatic-ecosystems'],
  },
  {
    id: 'estuary',
    label: 'estuaries',
    tier: 'core',
    terms: ['estuary', 'estuaries', 'estuarine', 'tidal waters'],
    topics: ['oceans-coasts', 'aquatic-ecosystems'],
  },
  {
    id: 'beaches',
    label: 'beaches and swimming water',
    tier: 'strong',
    terms: ['bathing beach', 'beach closure', 'beach water quality', 'swimming area', 'beach'],
    topics: ['oceans-coasts', 'water-quality'],
  },

  /* --- Flooding and resilience ------------------------------------------- */
  {
    id: 'sea-level-rise',
    label: 'sea level rise and coastal resilience',
    tier: 'core',
    terms: [
      'sea level rise',
      'sea-level rise',
      'coastal resilience',
      'coastal resiliency',
      'storm surge',
      'coastal erosion',
      'shoreline hardening',
      'living shoreline',
      'tidal flooding',
    ],
    topics: ['flooding-resilience', 'oceans-coasts'],
  },
  {
    id: 'flood-management',
    label: 'flood risk management',
    tier: 'core',
    terms: [
      'floodplain',
      'flood plain',
      'flood mitigation',
      'flood resilience',
      'flood hazard',
      'flood insurance',
      'flood control',
      'flood risk',
    ],
    topics: ['flooding-resilience'],
  },
  {
    id: 'flooding-generic',
    label: 'flooding',
    tier: 'moderate',
    terms: ['flooding', 'flood', 'floods', 'inundation'],
    topics: ['flooding-resilience'],
  },

  /* --- Infrastructure ---------------------------------------------------- */
  {
    id: 'water-infrastructure',
    label: 'water infrastructure',
    tier: 'core',
    terms: [
      'water infrastructure',
      'water main',
      'water mains',
      'water distribution system',
      'water treatment plant',
      'drinking water system',
      'clean water infrastructure',
      'water storage tank',
    ],
    topics: ['water-infrastructure', 'drinking-water'],
  },
  {
    id: 'water-utilities',
    label: 'water supply and utilities',
    tier: 'core',
    terms: [
      'water supply',
      'water utility',
      'water district',
      'water authority',
      'water rates',
      'water withdrawal',
      'water rights',
      'water conservation',
      'water affordability',
    ],
    topics: ['water-infrastructure', 'drinking-water'],
  },
  {
    id: 'dams-culverts',
    label: 'dams, culverts and flood structures',
    tier: 'strong',
    terms: [
      'dam safety',
      'dam removal',
      'culvert',
      'culverts',
      'levee',
      'seawall',
      'bulkhead',
      'dam',
      'dams',
    ],
    topics: ['water-infrastructure', 'flooding-resilience'],
  },

  /* --- Ecosystems and fisheries ------------------------------------------ */
  {
    id: 'aquatic-habitat',
    label: 'aquatic habitat',
    tier: 'core',
    terms: [
      'aquatic habitat',
      'aquatic ecosystem',
      'aquatic species',
      'fish passage',
      'fish ladder',
      'aquatic invasive species',
      'habitat restoration',
    ],
    topics: ['aquatic-ecosystems', 'watersheds-rivers'],
  },
  {
    id: 'fisheries',
    label: 'fisheries and shellfish',
    tier: 'core',
    terms: [
      'fishery',
      'fisheries',
      'marine fisheries',
      'shellfish',
      'shellfishing',
      'oyster',
      'oysters',
      'clam bed',
      'aquaculture',
      'hatchery',
      'spawning',
    ],
    topics: ['fisheries', 'aquatic-ecosystems'],
  },
  {
    id: 'fishing',
    label: 'fishing activity',
    tier: 'moderate',
    terms: ['fishing', 'angler', 'anglers', 'commercial fishing', 'recreational fishing'],
    topics: ['fisheries'],
  },
  {
    id: 'vessels',
    label: 'boats and vessel discharges',
    tier: 'moderate',
    terms: ['vessel discharge', 'ballast water', 'marina', 'boat pumpout', 'no discharge zone'],
    topics: ['water-quality', 'aquatic-ecosystems'],
  },

  /* --- Generic ------------------------------------------------------------ */
  {
    id: 'generic-water',
    label: 'water',
    tier: 'generic',
    terms: [
      'water',
      'waters',
      'waterway',
      'waterways',
      'aquatic',
      'river',
      'rivers',
      'lake',
      'lakes',
      'stream',
      'streams',
      'creek',
      'bay',
      'harbor',
      'pond',
      'reservoir',
      'coast',
      'coastal',
      'shore',
      'marine',
      'tidal',
    ],
    topics: [],
  },
];

/* ------------------------------------------------------------------------- */
/* Named New York waters                                                      */
/* ------------------------------------------------------------------------- */

export interface WaterBody {
  id: string;
  label: string;
  terms: string[];
  topics: TopicSlug[];
}

export const NY_WATER_BODIES: WaterBody[] = [
  {
    id: 'hudson-river',
    label: 'the Hudson River',
    terms: ['hudson river', 'hudson estuary'],
    topics: ['watersheds-rivers', 'oceans-coasts'],
  },
  {
    id: 'long-island-sound',
    label: 'Long Island Sound',
    terms: ['long island sound'],
    topics: ['long-island-sound', 'oceans-coasts'],
  },
  {
    id: 'atlantic-ocean',
    label: 'the Atlantic Ocean',
    terms: ['atlantic ocean', 'atlantic coast'],
    topics: ['oceans-coasts'],
  },
  {
    id: 'new-york-harbor',
    label: 'New York Harbor',
    terms: ['new york harbor', 'east river', 'hudson-raritan estuary', 'raritan bay'],
    topics: ['oceans-coasts', 'watersheds-rivers'],
  },
  {
    id: 'jamaica-bay',
    label: 'Jamaica Bay',
    terms: ['jamaica bay', 'great south bay', 'peconic bay', 'south shore estuary'],
    topics: ['oceans-coasts', 'aquatic-ecosystems'],
  },
  {
    id: 'great-lakes',
    label: 'the Great Lakes',
    terms: ['great lakes', 'lake erie', 'lake ontario', 'niagara river', 'st. lawrence river'],
    topics: ['great-lakes', 'watersheds-rivers'],
  },
  {
    id: 'finger-lakes',
    label: 'the Finger Lakes',
    terms: ['finger lakes', 'cayuga lake', 'seneca lake', 'owasco lake', 'skaneateles lake'],
    topics: ['great-lakes', 'water-quality'],
  },
  {
    id: 'lake-champlain',
    label: 'Lake Champlain',
    terms: ['lake champlain', 'lake george'],
    topics: ['watersheds-rivers', 'water-quality'],
  },
  {
    id: 'mohawk-delaware',
    label: 'the Mohawk and Delaware river basins',
    terms: [
      'mohawk river',
      'delaware river',
      'susquehanna river',
      'genesee river',
      'chemung river',
      'black river',
    ],
    topics: ['watersheds-rivers'],
  },
  {
    id: 'nyc-watersheds',
    label: 'the New York City water supply watersheds',
    terms: ['catskill watershed', 'croton watershed', 'delaware watershed', 'ashokan reservoir'],
    topics: ['watersheds-rivers', 'drinking-water'],
  },
  {
    id: 'urban-waterways',
    label: 'urban waterways',
    terms: ['onondaga lake', 'oneida lake', 'gowanus canal', 'newtown creek', 'buffalo river'],
    topics: ['water-quality', 'watersheds-rivers'],
  },
];

/* ------------------------------------------------------------------------- */
/* Committees that concentrate water legislation                              */
/* ------------------------------------------------------------------------- */

/** Matched case-insensitively as substrings of the committee name. */
export const WATER_RELEVANT_COMMITTEES: string[] = [
  'environmental conservation',
  'environment',
  'agriculture',
  'health',
  'energy',
  'local government',
  'corporations, authorities and commissions',
  'cities',
  'transportation',
];

/* ------------------------------------------------------------------------- */
/* Decoys — phrases that contain a water word but are not about water          */
/* ------------------------------------------------------------------------- */

/**
 * These are masked out of the text before matching, so "watershed moment" can
 * never contribute the "watershed" concept. This is the main defence against
 * idiomatic false positives.
 */
export const DECOY_PHRASES: string[] = [
  'watered down',
  'water down',
  'watershed moment',
  'in hot water',
  'hot water heater',
  'water heater',
  'waterproof',
  'watermark',
  'water cooler',
  'sea change',
  'dead in the water',
  'hold water',
  'holds water',
  'test the waters',
  'uncharted waters',
  'flood the market',
  'flooded the market',
  'flood of applications',
  'floodgate',
  'floodgates',
  'water bearer',
  'firewater',
  'waterboarding',
  'water tower clock',
  // Corporate-finance term of art: stock issued above the value of its assets.
  'watered stock',
  'stock watering',
  // New York place names that contain "water" but say nothing about water policy.
  // A genuine bill about one of these places still uses real water vocabulary
  // elsewhere, so masking the name costs nothing and removes a whole class of
  // false positives.
  'waterford',
  'watertown',
  'watervliet',
  'waterloo',
  'water mill',
  'waterville',
  'watermill',
  'water street',
];

/**
 * Titles that look like omnibus/budget vehicles. A bare mention of water inside
 * a 40,000 word appropriations bill is not water policy.
 */
export const DILUTION_TITLE_PATTERNS: RegExp[] = [
  /\bbudget\b/i,
  /\bappropriat/i,
  /\bomnibus\b/i,
  /\benacts? into law major components\b/i,
  /\bstate operations\b/i,
];

/* ------------------------------------------------------------------------- */
/* Discovery searches                                                         */
/* ------------------------------------------------------------------------- */

export interface CandidateSearch {
  id: string;
  /** LegiScan full-text query. Keep these broad but bounded. */
  query: string;
  /** Hard cap on result pages (50 results per page, 1 API query per page). */
  maxPages: number;
  /** Stop paging once LegiScan relevance drops below this. */
  minRelevance: number;
}

/**
 * ~24 searches x up to 2 pages = at most ~48 API queries per run for discovery.
 * Against a 30,000/month budget that leaves ample room for bill detail fetches.
 */
export const CANDIDATE_SEARCHES: CandidateSearch[] = [
  {
    id: 'drinking-water',
    query: '"drinking water" OR "potable water" OR "public water supply"',
    maxPages: 2,
    minRelevance: 50,
  },
  {
    id: 'water-quality',
    query: '"water quality" OR "water pollution" OR "impaired waters"',
    maxPages: 2,
    minRelevance: 50,
  },
  {
    id: 'pfas',
    query: 'PFAS OR PFOA OR PFOS OR perfluoroalkyl OR "emerging contaminants"',
    maxPages: 2,
    minRelevance: 40,
  },
  {
    id: 'lead',
    query: '"lead service line" OR "lead in drinking water"',
    maxPages: 1,
    minRelevance: 40,
  },
  {
    id: 'groundwater',
    query: 'groundwater OR aquifer OR "well water"',
    maxPages: 2,
    minRelevance: 50,
  },
  {
    id: 'watershed',
    query: 'watershed OR "source water protection"',
    maxPages: 2,
    minRelevance: 50,
  },
  {
    id: 'wetlands',
    query: 'wetlands OR "tidal wetlands" OR "freshwater wetlands"',
    maxPages: 2,
    minRelevance: 50,
  },
  {
    id: 'algal-blooms',
    query: '"harmful algal bloom" OR "algal bloom" OR eutrophication OR "nutrient pollution"',
    maxPages: 1,
    minRelevance: 40,
  },
  {
    id: 'wastewater',
    query: 'wastewater OR sewage OR "combined sewer overflow" OR "sewer district"',
    maxPages: 2,
    minRelevance: 50,
  },
  {
    id: 'stormwater',
    query: 'stormwater OR "storm water" OR "nonpoint source" OR "green infrastructure"',
    maxPages: 2,
    minRelevance: 50,
  },
  {
    id: 'coastal-resilience',
    query: '"sea level rise" OR "coastal resilience" OR "storm surge" OR "coastal erosion"',
    maxPages: 2,
    minRelevance: 45,
  },
  {
    id: 'flooding',
    query: 'floodplain OR "flood mitigation" OR "flood hazard" OR "flood insurance"',
    maxPages: 2,
    minRelevance: 50,
  },
  {
    id: 'ocean-marine',
    query: 'ocean OR "marine resources" OR "ocean acidification"',
    maxPages: 2,
    minRelevance: 55,
  },
  {
    id: 'coastal',
    query: '"coastal zone" OR shoreline OR "bathing beach" OR "waterfront revitalization"',
    maxPages: 2,
    minRelevance: 50,
  },
  {
    id: 'estuary',
    query: 'estuary OR estuarine OR "Long Island Sound"',
    maxPages: 1,
    minRelevance: 45,
  },
  {
    id: 'ny-rivers',
    query: '"Hudson River" OR "New York Harbor" OR "Jamaica Bay" OR "East River"',
    maxPages: 1,
    minRelevance: 45,
  },
  {
    id: 'great-lakes',
    query: '"Great Lakes" OR "Lake Erie" OR "Lake Ontario" OR "Finger Lakes"',
    maxPages: 1,
    minRelevance: 45,
  },
  {
    id: 'plastics',
    query: 'microplastics OR "marine debris" OR "plastic pollution" OR "single-use plastic"',
    maxPages: 1,
    minRelevance: 45,
  },
  {
    id: 'fisheries',
    query: 'fisheries OR shellfish OR "fish passage" OR "aquatic habitat"',
    maxPages: 2,
    minRelevance: 50,
  },
  {
    id: 'water-infrastructure',
    query: '"water infrastructure" OR "water main" OR "water treatment plant"',
    maxPages: 2,
    minRelevance: 50,
  },
  {
    id: 'treatment-septic',
    query: '"wastewater treatment" OR "sewage treatment" OR "septic system"',
    maxPages: 2,
    minRelevance: 50,
  },
  {
    id: 'dams',
    query: '"dam safety" OR culvert OR "stream restoration" OR "dam removal"',
    maxPages: 1,
    minRelevance: 45,
  },
  {
    id: 'water-supply',
    query: '"water supply" OR "water district" OR "water authority" OR "water rates"',
    maxPages: 2,
    minRelevance: 50,
  },
  {
    id: 'water-withdrawal',
    query: '"water withdrawal" OR "water conservation" OR "water rights"',
    maxPages: 1,
    minRelevance: 45,
  },
];

/* ------------------------------------------------------------------------- */
/* Scoring configuration                                                      */
/* ------------------------------------------------------------------------- */

export const SCORING = {
  /**
   * Score at or above this is tracked. Calibrated so that one core concept in
   * the title (59) or one official water subject tag (53) is enough, while a
   * single moderate word in the title (31) is not.
   */
  relevanceThreshold: 40,
  /**
   * Cheap pre-screen applied to search results (title only, no API cost).
   * Anything at or above this earns a getBill call.
   */
  prescreenThreshold: 12,
  /**
   * Converts unbounded raw points into 0-100 with diminishing returns:
   * score = 100 x (1 - e^(-raw/k)). Larger k keeps strongly-matching bills
   * distinguishable from each other instead of all saturating at 100.
   */
  normalizationConstant: 40,
  /** Repeat mentions add a little, but never dominate a title match. */
  repeatBonusPerMatch: 0.25,
  repeatBonusCap: 1.5,
  /** Minimum occurrences required before body text counts at all. */
  minTextOccurrences: 2,
  minGenericTextOccurrences: 4,
  /** Applied when only generic words matched inside a budget-style vehicle. */
  dilutionPenalty: 0.5,
  /** Points a topic must accumulate before it is attached to a bill. */
  topicAssignmentThreshold: 6,
  maxTopicsPerBill: 5,
} as const;

export const CLASSIFIER_VERSION = 'deterministic-1.0.0';
