import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readFile, writeFile, stat } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { loadCredentials, saveCredentials, getApiKey } from "../credentials.js";

let tempHome: string;

beforeEach(async () => {
  tempHome = await mkdtemp(join(tmpdir(), "beacon-creds-test-"));
});

afterEach(async () => {
  await rm(tempHome, { recursive: true, force: true });
});

describe("loadCredentials", () => {
  it("returns empty credentials when file does not exist", async () => {
    const creds = await loadCredentials(tempHome);
    expect(creds).toEqual({ providers: {} });
  });

  it("reads existing credentials file", async () => {
    const data = {
      activeProvider: "claude",
      providers: { claude: { apiKey: "sk-ant-test" } },
    };
    await writeFile(
      join(tempHome, "credentials.json"),
      JSON.stringify(data)
    );
    const creds = await loadCredentials(tempHome);
    expect(creds.activeProvider).toBe("claude");
    expect(creds.providers.claude?.apiKey).toBe("sk-ant-test");
  });

  it("returns empty credentials when file has invalid JSON", async () => {
    await writeFile(join(tempHome, "credentials.json"), "bad json");
    const creds = await loadCredentials(tempHome);
    expect(creds).toEqual({ providers: {} });
  });
});

describe("saveCredentials", () => {
  it("writes credentials file", async () => {
    await saveCredentials(tempHome, {
      activeProvider: "openai",
      providers: { openai: { apiKey: "sk-test" } },
    });
    const content = await readFile(
      join(tempHome, "credentials.json"),
      "utf-8"
    );
    const parsed = JSON.parse(content);
    expect(parsed.activeProvider).toBe("openai");
    expect(parsed.providers.openai.apiKey).toBe("sk-test");
  });

  it("creates directory if it does not exist", async () => {
    const nested = join(tempHome, "subdir");
    await saveCredentials(nested, {
      providers: { claude: { apiKey: "key" } },
    });
    const content = await readFile(
      join(nested, "credentials.json"),
      "utf-8"
    );
    expect(JSON.parse(content).providers.claude.apiKey).toBe("key");
  });

  it("sets file permissions to 0600", async () => {
    await saveCredentials(tempHome, {
      providers: { claude: { apiKey: "key" } },
    });
    const fileStat = await stat(join(tempHome, "credentials.json"));
    const mode = (fileStat.mode & 0o777).toString(8);
    expect(mode).toBe("600");
  });
});

describe("getApiKey", () => {
  it("returns key from credentials for active provider", async () => {
    await saveCredentials(tempHome, {
      activeProvider: "claude",
      providers: { claude: { apiKey: "cred-key" } },
    });
    const key = await getApiKey("claude", tempHome);
    expect(key).toBe("cred-key");
  });

  it("returns undefined when provider has no stored key", async () => {
    await saveCredentials(tempHome, {
      providers: {},
    });
    const key = await getApiKey("openai", tempHome);
    expect(key).toBeUndefined();
  });
});
