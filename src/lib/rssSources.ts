// Country -> RSS feed mapping. These outlets don't tag articles by country,
// so coverage is region-level: a country gets its region's feed, falling
// back to global "world" feeds when no closer regional feed exists.
// All URLs verified live (BBC/Al Jazeera/France24/DW/NPR/CNN) — see ROADMAP.md §4.
// Reuters RSS is dead (killed 2020) and intentionally excluded.

export interface FeedSource {
  name: string;
  url: string;
}

const BBC_WORLD: FeedSource = {
  name: "BBC News",
  url: "https://feeds.bbci.co.uk/news/world/rss.xml",
};
const BBC_EUROPE: FeedSource = {
  name: "BBC News",
  url: "https://feeds.bbci.co.uk/news/world/europe/rss.xml",
};
const BBC_ASIA: FeedSource = {
  name: "BBC News",
  url: "https://feeds.bbci.co.uk/news/world/asia/rss.xml",
};
const BBC_AFRICA: FeedSource = {
  name: "BBC News",
  url: "https://feeds.bbci.co.uk/news/world/africa/rss.xml",
};
const BBC_US_CANADA: FeedSource = {
  name: "BBC News",
  url: "https://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml",
};
const BBC_MIDDLE_EAST: FeedSource = {
  name: "BBC News",
  url: "https://feeds.bbci.co.uk/news/world/middle_east/rss.xml",
};
const AL_JAZEERA: FeedSource = {
  name: "Al Jazeera",
  url: "https://www.aljazeera.com/xml/rss/all.xml",
};
const FRANCE24: FeedSource = {
  name: "France 24",
  url: "https://www.france24.com/en/rss",
};
const DW: FeedSource = {
  name: "DW",
  url: "https://rss.dw.com/xml/rss-en-all",
};
const NPR: FeedSource = {
  name: "NPR",
  url: "https://feeds.npr.org/1001/rss.xml",
};
const CNN_WORLD: FeedSource = {
  name: "CNN",
  url: "http://rss.cnn.com/rss/edition_world.rss",
};

// Default feed set for any country not explicitly mapped below.
const GLOBAL_DEFAULT: FeedSource[] = [BBC_WORLD, AL_JAZEERA];

const REGION_FEEDS: Record<string, FeedSource[]> = {
  // North America
  US: [BBC_US_CANADA, NPR, CNN_WORLD],
  CA: [BBC_US_CANADA, CNN_WORLD],
  MX: [BBC_US_CANADA, AL_JAZEERA],

  // Europe
  GB: [BBC_EUROPE, BBC_WORLD],
  FR: [FRANCE24, BBC_EUROPE],
  DE: [DW, BBC_EUROPE],
  IE: [BBC_EUROPE],
  ES: [BBC_EUROPE, FRANCE24],
  IT: [BBC_EUROPE, FRANCE24],
  PT: [BBC_EUROPE, FRANCE24],
  NL: [BBC_EUROPE, DW],
  BE: [BBC_EUROPE, FRANCE24],
  CH: [DW, BBC_EUROPE],
  AT: [DW, BBC_EUROPE],
  PL: [BBC_EUROPE, DW],
  UA: [BBC_EUROPE, DW],
  RU: [BBC_EUROPE, DW],
  SE: [BBC_EUROPE, DW],
  NO: [BBC_EUROPE, DW],
  FI: [BBC_EUROPE, DW],
  DK: [BBC_EUROPE, DW],
  GR: [BBC_EUROPE, FRANCE24],
  TR: [BBC_MIDDLE_EAST, AL_JAZEERA],

  // Middle East
  IL: [BBC_MIDDLE_EAST, AL_JAZEERA],
  PS: [AL_JAZEERA, BBC_MIDDLE_EAST],
  SA: [AL_JAZEERA, BBC_MIDDLE_EAST],
  AE: [AL_JAZEERA, BBC_MIDDLE_EAST],
  QA: [AL_JAZEERA, BBC_MIDDLE_EAST],
  IQ: [AL_JAZEERA, BBC_MIDDLE_EAST],
  IR: [BBC_MIDDLE_EAST, AL_JAZEERA],
  SY: [AL_JAZEERA, BBC_MIDDLE_EAST],
  LB: [AL_JAZEERA, BBC_MIDDLE_EAST],
  JO: [AL_JAZEERA, BBC_MIDDLE_EAST],
  YE: [AL_JAZEERA, BBC_MIDDLE_EAST],
  EG: [AL_JAZEERA, BBC_MIDDLE_EAST],

  // Asia
  CN: [BBC_ASIA, AL_JAZEERA],
  JP: [BBC_ASIA],
  KR: [BBC_ASIA],
  KP: [BBC_ASIA],
  IN: [BBC_ASIA, AL_JAZEERA],
  PK: [BBC_ASIA, AL_JAZEERA],
  BD: [BBC_ASIA, AL_JAZEERA],
  AF: [BBC_ASIA, AL_JAZEERA],
  ID: [BBC_ASIA, AL_JAZEERA],
  MY: [BBC_ASIA, AL_JAZEERA],
  SG: [BBC_ASIA],
  TH: [BBC_ASIA, AL_JAZEERA],
  VN: [BBC_ASIA],
  PH: [BBC_ASIA, AL_JAZEERA],
  MM: [BBC_ASIA, AL_JAZEERA],

  // Africa
  ZA: [BBC_AFRICA, AL_JAZEERA],
  NG: [BBC_AFRICA, AL_JAZEERA],
  KE: [BBC_AFRICA, AL_JAZEERA],
  ET: [BBC_AFRICA, AL_JAZEERA],
  GH: [BBC_AFRICA, AL_JAZEERA],
  MA: [BBC_AFRICA, FRANCE24],
  DZ: [BBC_AFRICA, FRANCE24],
  TN: [BBC_AFRICA, FRANCE24],
  LY: [BBC_AFRICA, AL_JAZEERA],
  SD: [BBC_AFRICA, AL_JAZEERA],
  SN: [BBC_AFRICA, FRANCE24],
  CI: [BBC_AFRICA, FRANCE24],

  // Oceania
  AU: [BBC_ASIA, AL_JAZEERA],
  NZ: [BBC_ASIA],

  // South America
  BR: [BBC_US_CANADA, AL_JAZEERA],
  AR: [BBC_US_CANADA, AL_JAZEERA],
  CO: [BBC_US_CANADA, AL_JAZEERA],
  CL: [BBC_US_CANADA, AL_JAZEERA],
  PE: [BBC_US_CANADA, AL_JAZEERA],
  VE: [BBC_US_CANADA, AL_JAZEERA],
};

export function feedsForCountry(isoCode: string): FeedSource[] {
  return REGION_FEEDS[isoCode] ?? GLOBAL_DEFAULT;
}
