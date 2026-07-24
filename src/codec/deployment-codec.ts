import type { Deployment, DeploymentInput } from "../models/resources/deployment.js";
import type { Link, XLink } from "../models/common/link.js";
import type { DeployedSystem, NamedDeployedSystem } from "../models/sensorml/sml-deployment.js";
import type { DeploymentFeature } from "../models/geojson/deployment-feature.js";
import type { SmlDeployment } from "../models/sensorml/sml-deployment.js";
import { toCamelKeys, toWireKeys } from "./keys.js";
import { findRelationLink, withoutRelationLinks } from "./relation-links.js";

const DEPLOYMENT_SERVER_LINK_RELATIONS = [
  "parentDeployment",
  "subdeployments",
  "featuresOfInterest",
  "samplingFeatures",
  "datastreams",
  "controlstreams",
] as const;

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
  const platformLink = props.platformLink as Link | undefined;
  const deployedSystemsLink = props.deployedSystemsLink as Link[] | undefined;
  const links = feature.links;
  return {
    sourceEncoding: "geojson",
    id: feature.id,
    uniqueId: props.uid as string,
    label: props.name as string,
    description: props.description as string | undefined,
    featureType: props.featureType as string,
    validTime: props.validTime as Deployment["validTime"],
    links: withoutRelationLinks(links, DEPLOYMENT_SERVER_LINK_RELATIONS),
    parentDeployment: findRelationLink(links, "parentDeployment"),
    subdeployments: findRelationLink(links, "subdeployments"),
    featuresOfInterest: findRelationLink(links, "featuresOfInterest"),
    samplingFeatures: findRelationLink(links, "samplingFeatures"),
    datastreams: findRelationLink(links, "datastreams"),
    controlstreams: findRelationLink(links, "controlstreams"),
    location: feature.geometry ?? undefined,
    bbox: feature.bbox,
    platform: linkToDeployedSystem(platformLink),
    deployedSystems: linksToNamedDeployedSystems(deployedSystemsLink),
    raw: feature,
  };
}

export function deploymentFromSml(doc: SmlDeployment): Deployment {
  const links = doc.links;
  return {
    sourceEncoding: "sml",
    id: doc.id,
    uniqueId: doc.uniqueId ?? "",
    label: doc.label,
    description: doc.description,
    featureType: doc.definition ?? "",
    validTime: doc.validTime as Deployment["validTime"],
    links: withoutRelationLinks(links, DEPLOYMENT_SERVER_LINK_RELATIONS),
    parentDeployment: findRelationLink(links, "parentDeployment"),
    subdeployments: findRelationLink(links, "subdeployments"),
    featuresOfInterest: findRelationLink(links, "featuresOfInterest"),
    samplingFeatures: findRelationLink(links, "samplingFeatures"),
    datastreams: findRelationLink(links, "datastreams"),
    controlstreams: findRelationLink(links, "controlstreams"),
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
    platformLink: deployedSystemToLink(input.platform),
    deployedSystemsLink: namedDeployedSystemsToLinks(input.deployedSystems),
  });
  return {
    type: "Feature",
    geometry: input.location ?? null,
    bbox: input.bbox,
    properties,
    links: withoutRelationLinks(input.links, DEPLOYMENT_SERVER_LINK_RELATIONS),
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
    location: input.location,
    platform: input.platform,
    deployedSystems: input.deployedSystems,
    links: withoutRelationLinks(input.links, DEPLOYMENT_SERVER_LINK_RELATIONS),
  } as unknown as SmlDeployment;
}
