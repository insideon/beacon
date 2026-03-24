export interface BeaconConfig {
  provider?: string;
  outputFormat?: "terminal" | "json";
}

export async function loadConfig(_projectPath: string): Promise<BeaconConfig> {
  return {};
}
