import type { Deployment, DeploymentInput } from "../models/resources/deployment.js";
import type { Link, XLink } from "../models/common/link.js";
import type { DeployedSystem, NamedDeployedSystem } from "../models/sensorml/sml-deployment.js";
import type { DeploymentFeature } from "../models/geojson/deployment-feature.js";
import type { SmlDeployment } from "../models/sensorml/sml-deployment.js";
import { toCamelKeys, toWireKeys } from "./keys.js";

function linkToDeployedSystem(link: Link | undefined): DeployedSystem | undefined {
  return link ? { system: link as XLink } : undefined;
}

function deployedSystemToLink(deployedSystem: DeployedSystem | undefined): Link | undefined {
  return deployedSystem?.system as Link | undefined;
}

function deployedSystemName(link: Link, index: number): string {
  const source = link.title ?? link.uid ?? link.href ?? `deployedSystem${index + 1}`;
  const name = source.split(/[/:#?&=]+/).filter(Boolean).at(-1) ?? `deployedSystem${index + 1}`;
  const cleaned = name.replace(/[^A-Za-z0-9_-]/g, "_");
  return /^[A-Za-z]/.test(cleaned) ? cleaned : `deployedSystem${index + 1}`;
}

function linksToNamedDeployedSystems(links: Link[] | undefined): NamedDeployedSystem[] | undefined {
  return links?.map((link, index) => ({ name: deployedSystemName(link, index), system: link as XLink }));
}

function namedDeployedSystemsToLinks(deployedSystems: NamedDeployedSystem[] | undefined): Link[] | undefined {
  return deployedSystems?.map((deployedSystem) => deployedSystem.system as Link);
}

export function deploymentFromGeoJson(feature: DeploymentFeature): Deployment {
  const props = toCamelKeys<Record<string, unknown>>(feature.properties);
  const platformLink = props.platformLink as Deployment["platformLink"];
  const deployedSystemsLink = props.deployedSystemsLink as Deployment["deployedSystemsLink"];
  return {
    sourceEncoding: "geojson",
    id: feature.id,
    uniqueId: props.uid as string,
    label: props.name as string,
    description: props.description as string | undefined,
    featureType: props.featureType as string,
    validTime: props.validTime as Deployment["validTime"],
    links: feature.links,
    location: feature.geometry ?? undefined,
    geometry: feature.geometry,
    bbox: feature.bbox,
    platform: linkToDeployedSystem(platformLink),
    deployedSystems: linksToNamedDeployedSystems(deployedSystemsLink),
    platformLink,
    deployedSystemsLink,
    raw: feature,
  };
}

export function deploymentFromSml(doc: SmlDeployment): Deployment {
  return {
    sourceEncoding: "sml",
    id: doc.id,
    uniqueId: doc.uniqueId ?? "",
    label: doc.label,
    description: doc.description,
    featureType: doc.definition ?? "",
    validTime: doc.validTime as Deployment["validTime"],
    links: doc.links,
    lang: doc.lang,
    keywords: doc.keywords,
    identifiers: doc.identifiers,
    classifiers: doc.classifiers,
    legalConstraints: doc.legalConstraints,
    contacts: doc.contacts,
    documents: doc.documents,
    history: doc.history,
    location: doc.location,
    platform: doc.platform,
    deployedSystems: doc.deployedSystems,
    geometry: doc.location,
    platformLink: deployedSystemToLink(doc.platform),
    deployedSystemsLink: namedDeployedSystemsToLinks(doc.deployedSystems),
    raw: doc,
  };
}

export function deploymentToGeoJson(input: DeploymentInput): DeploymentFeature {
  const properties = toWireKeys<Record<string, unknown>>({
    featureType: input.featureType,
    uid: input.uniqueId,
    name: input.label,
    description: input.description,
    validTime: input.validTime,
    platformLink: input.platformLink ?? deployedSystemToLink(input.platform),
    deployedSystemsLink: input.deployedSystemsLink ?? namedDeployedSystemsToLinks(input.deployedSystems),
  });
  return {
    type: "Feature",
    geometry: input.geometry ?? input.location ?? null,
    bbox: input.bbox,
    properties,
    links: input.links,
  } as DeploymentFeature;
}

export function deploymentToSml(input: DeploymentInput): SmlDeployment {
  return {
    type: "Deployment",
    uniqueId: input.uniqueId,
    label: input.label,
    description: input.description,
    definition: input.featureType,
    validTime: input.validTime,
    lang: input.lang,
    keywords: input.keywords,
    identifiers: input.identifiers,
    classifiers: input.classifiers,
    legalConstraints: input.legalConstraints,
    contacts: input.contacts,
    documents: input.documents,
    history: input.history,
    location: input.location ?? input.geometry ?? undefined,
    platform: input.platform ?? linkToDeployedSystem(input.platformLink),
    deployedSystems: input.deployedSystems ?? linksToNamedDeployedSystems(input.deployedSystemsLink),
    links: input.links,
  } as unknown as SmlDeployment;
}
