import { HttpClient, type CsApiClientOptions } from "../http/http-client.js";
import { SystemsApi } from "./systems.js";
import { DeploymentsApi } from "./deployments.js";
import { ProceduresApi } from "./procedures.js";
import { SamplingFeaturesApi } from "./sampling-features.js";
import { PropertiesApi } from "./properties.js";
import { CollectionsApi } from "./collections.js";
import { DataStreamsApi } from "./datastreams.js";
import { ObservationsApi } from "./observations.js";
import { ControlStreamsApi } from "./control-streams.js";
import { CommandsApi } from "./commands.js";
import { SystemEventsApi, SystemHistoryApi } from "./system-events.js";
import { CSPubSubClient } from "../pubsub/client.js";

/** Root client for OGC API Connected Systems, covering both Part 1 (systems, procedures,
 * deployments, sampling features, properties, collections) and Part 2 (datastreams,
 * observations, control streams, commands, system events/history). */
export class CSApiClient {
  readonly http: HttpClient;

  // Part 1
  readonly systems: SystemsApi;
  readonly deployments: DeploymentsApi;
  readonly procedures: ProceduresApi;
  readonly samplingFeatures: SamplingFeaturesApi;
  readonly properties: PropertiesApi;
  readonly collections: CollectionsApi;

  // Part 2
  readonly datastreams: DataStreamsApi;
  readonly observations: ObservationsApi;
  readonly controlstreams: ControlStreamsApi;
  readonly commands: CommandsApi;
  readonly systemEvents: SystemEventsApi;
  readonly systemHistory: SystemHistoryApi;
  readonly pubsub?: CSPubSubClient;

  constructor(options: CsApiClientOptions) {
    this.http = new HttpClient(options);

    this.systems = new SystemsApi(this.http);
    this.deployments = new DeploymentsApi(this.http);
    this.procedures = new ProceduresApi(this.http);
    this.samplingFeatures = new SamplingFeaturesApi(this.http);
    this.properties = new PropertiesApi(this.http);
    this.collections = new CollectionsApi(this.http);

    this.datastreams = new DataStreamsApi(this.http);
    this.observations = new ObservationsApi(this.http);
    this.controlstreams = new ControlStreamsApi(this.http);
    this.commands = new CommandsApi(this.http);
    this.systemEvents = new SystemEventsApi(this.http);
    this.systemHistory = new SystemHistoryApi(this.http);
    this.pubsub = options.pubsub ? new CSPubSubClient(options.pubsub) : undefined;
  }
}
