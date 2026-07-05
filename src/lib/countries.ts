import { geoCentroid, geoArea } from "d3-geo";
import type { Feature, Geometry, Polygon } from "geojson";

export interface CountryProperties {
  ADMIN: string;
  ISO_A2: string;
  ADM0_A3: string;
  [key: string]: unknown;
}

export type CountryFeature = Feature<Geometry, CountryProperties>;

// Natural Earth marks a few countries (e.g. France, Norway) with ISO_A2 "-99";
// fall back to the stable ADM0_A3 code so every country stays selectable.
export function countryId(feature: CountryFeature): string {
  const iso = feature.properties.ISO_A2;
  return iso && iso !== "-99" ? iso : feature.properties.ADM0_A3;
}

export function countryName(feature: CountryFeature): string {
  return feature.properties.ADMIN;
}

export function countryCentroid(feature: CountryFeature): {
  lat: number;
  lng: number;
} {
  let geometry = feature.geometry;
  
  if (geometry.type === "MultiPolygon") {
    let maxArea = -1;
    let largestPolygon: Polygon | null = null;
    
    // Find the largest polygon (the mainland) to prevent overseas territories 
    // from pulling the centroid into the middle of the ocean.
    for (const coords of geometry.coordinates) {
      const poly: Polygon = { type: "Polygon", coordinates: coords };
      const area = geoArea(poly);
      if (area > maxArea) {
        maxArea = area;
        largestPolygon = poly;
      }
    }
    if (largestPolygon) {
      geometry = largestPolygon;
    }
  }

  const [lng, lat] = geoCentroid(geometry);
  return { lat, lng };
}

export async function loadCountries(): Promise<CountryFeature[]> {
  const res = await fetch("/data/countries-110m.geojson");
  if (!res.ok) throw new Error(`Failed to load country data: ${res.status}`);
  const geojson = (await res.json()) as { features: CountryFeature[] };
  return geojson.features
    .filter((f) => f.properties.ISO_A2 !== "AQ")
    .sort((a, b) => countryName(a).localeCompare(countryName(b)));
}
