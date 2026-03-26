import { readFile, writeFile, mkdir, chmod } from "fs/promises";
import { join } from "path";
import { homedir } from "os";

export interface Credentials {
  activeProvider?: string;
  providers: Record<string, { apiKey: string }>;
}

const CREDENTIALS_FILE = "credentials.json";

function getDefaultBeaconDir(): string {
  return join(homedir(), ".beacon");
}

export async function loadCredentials(
  beaconDir: string = getDefaultBeaconDir()
): Promise<Credentials> {
  try {
    const content = await readFile(
      join(beaconDir, CREDENTIALS_FILE),
      "utf-8"
    );
    return JSON.parse(content) as Credentials;
  } catch {
    return { providers: {} };
  }
}

export async function saveCredentials(
  beaconDir: string = getDefaultBeaconDir(),
  credentials: Credentials
): Promise<void> {
  await mkdir(beaconDir, { recursive: true });
  const filePath = join(beaconDir, CREDENTIALS_FILE);
  await writeFile(filePath, JSON.stringify(credentials, null, 2) + "\n", "utf-8");
  await chmod(filePath, 0o600);
}

export async function getApiKey(
  provider: string,
  beaconDir: string = getDefaultBeaconDir()
): Promise<string | undefined> {
  const creds = await loadCredentials(beaconDir);
  return creds.providers[provider]?.apiKey;
}
