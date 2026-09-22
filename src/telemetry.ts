import { ManagedIdentityCredential } from "@azure/identity";
import { useAzureMonitor } from "@azure/monitor-opentelemetry";

const globalTelemetryState = globalThis as typeof globalThis & {
  __experimentsAiBotTelemetryInitialized__?: boolean;
};

initializeTelemetry();

function initializeTelemetry(): void {
  if (globalTelemetryState.__experimentsAiBotTelemetryInitialized__) {
    return;
  }

  const connectionString = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING?.trim();
  if (!connectionString) {
    return;
  }

  const credential = resolveAzureMonitorCredential(
    process.env.APPLICATIONINSIGHTS_AUTHENTICATION_STRING,
  );

  useAzureMonitor({
    azureMonitorExporterOptions: {
      connectionString,
      ...(credential ? { credential } : {}),
    },
    enableLiveMetrics: false,
    enablePerformanceCounters: false,
    enableStandardMetrics: false,
    instrumentationOptions: {
      azureSdk: { enabled: false },
      console: { enabled: true },
      http: { enabled: false },
      mongoDb: { enabled: false },
      mySql: { enabled: false },
      postgreSql: { enabled: false },
      redis: { enabled: false },
      redis4: { enabled: false },
    },
  });

  globalTelemetryState.__experimentsAiBotTelemetryInitialized__ = true;
}

function resolveAzureMonitorCredential(
  authenticationString: string | undefined,
): ManagedIdentityCredential | undefined {
  if (!authenticationString) {
    return undefined;
  }

  const settings = new Map<string, string>();

  for (const segment of authenticationString.split(";")) {
    const trimmedSegment = segment.trim();
    if (!trimmedSegment) {
      continue;
    }

    const delimiterIndex = trimmedSegment.indexOf("=");
    if (delimiterIndex <= 0) {
      continue;
    }

    const key = trimmedSegment.slice(0, delimiterIndex).trim().toLowerCase();
    const value = trimmedSegment.slice(delimiterIndex + 1).trim();

    if (value) {
      settings.set(key, value);
    }
  }

  if (settings.get("authorization")?.toUpperCase() !== "AAD") {
    return undefined;
  }

  const clientId = settings.get("clientid");
  return clientId
    ? new ManagedIdentityCredential({ clientId })
    : new ManagedIdentityCredential();
}
