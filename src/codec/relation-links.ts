import type { Link } from "../models/common/link.js";

const OGC_REL_PREFIX = "ogc-rel:";

function relTokens(link: Link): string[] {
  return link.rel?.split(/\s+/).filter(Boolean) ?? [];
}

export function linkHasRelation(link: Link, relation: string): boolean {
  return relTokens(link).some((rel) => rel === relation || rel === `${OGC_REL_PREFIX}${relation}`);
}

export function findRelationLink(links: Link[] | undefined, relation: string): Link | undefined {
  return links?.find((link) => linkHasRelation(link, relation));
}

export function withoutRelationLinks(links: Link[] | undefined, relations: readonly string[]): Link[] | undefined {
  if (!links) return undefined;
  const filtered = links.filter((link) => !relations.some((relation) => linkHasRelation(link, relation)));
  return filtered.length ? filtered : undefined;
}
