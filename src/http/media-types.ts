export const MediaTypes = {
  geoJson: "application/geo+json",
  smlJson: "application/sml+json",
  json: "application/json",
  omJson: "application/om+json",
  cmdJson: "application/cmd+json",
  problemJson: "application/problem+json",
  sweJson: "application/swe+json",
} as const;

export type GeoJsonOrSml = "geojson" | "sml";
