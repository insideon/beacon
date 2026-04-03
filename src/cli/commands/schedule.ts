import { writeFile, readFile, unlink } from "fs/promises";
import { join } from "path";
import { execSync } from "child_process";
import { homedir, platform } from "os";
import chalk from "chalk";

const PLIST_NAME = "com.beacon.reminder";
const PLIST_PATH = join(homedir(), "Library", "LaunchAgents", `${PLIST_NAME}.plist`);

function getBeaconPath(): string {
  try {
    return execSync("which beacon", { encoding: "utf-8" }).trim();
  } catch {
    return "npx beacon";
  }
}

function buildPlist(hour: number, minute: number, projectPath: string): string {
  const beaconPath = getBeaconPath();
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${PLIST_NAME}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>-c</string>
    <string>cd "${projectPath}" &amp;&amp; ${beaconPath} todo --today 2>/dev/null | /usr/bin/osascript -e 'set input to do shell script "cat"' -e 'display notification input with title "Beacon"'</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key>
    <integer>${hour}</integer>
    <key>Minute</key>
    <integer>${minute}</integer>
  </dict>
  <key>StandardErrorPath</key>
  <string>/tmp/beacon-schedule-err.log</string>
</dict>
</plist>`;
}

function buildCrontab(hour: number, minute: number, projectPath: string): string {
  const beaconPath = getBeaconPath();
  return `${minute} ${hour} * * * cd "${projectPath}" && ${beaconPath} todo --today 2>/dev/null | notify-send "Beacon" "$(cat)" 2>/dev/null || true`;
}

async function setScheduleMacOS(hour: number, minute: number): Promise<void> {
  const projectPath = process.cwd();
  const plist = buildPlist(hour, minute, projectPath);
  await writeFile(PLIST_PATH, plist, "utf-8");

  try {
    execSync(`launchctl unload "${PLIST_PATH}" 2>/dev/null`, { encoding: "utf-8" });
  } catch {
    // May not be loaded yet
  }
  execSync(`launchctl load "${PLIST_PATH}"`, { encoding: "utf-8" });
}

async function setScheduleLinux(hour: number, minute: number): Promise<void> {
  const cronLine = buildCrontab(hour, minute, process.cwd());
  const MARKER = "# beacon-schedule";

  let existing = "";
  try {
    existing = execSync("crontab -l 2>/dev/null", { encoding: "utf-8" });
  } catch {
    // No crontab yet
  }

  // Remove old beacon entry
  const lines = existing.split("\n").filter((l) => !l.includes(MARKER));
  lines.push(`${cronLine} ${MARKER}`);

  const newCrontab = lines.filter((l) => l.trim() !== "").join("\n") + "\n";
  execSync(`echo '${newCrontab}' | crontab -`, { encoding: "utf-8" });
}

async function removeScheduleMacOS(): Promise<void> {
  try {
    execSync(`launchctl unload "${PLIST_PATH}" 2>/dev/null`, { encoding: "utf-8" });
  } catch {
    // May not be loaded
  }
  try {
    await unlink(PLIST_PATH);
  } catch {
    // May not exist
  }
}

async function removeScheduleLinux(): Promise<void> {
  const MARKER = "# beacon-schedule";
  let existing = "";
  try {
    existing = execSync("crontab -l 2>/dev/null", { encoding: "utf-8" });
  } catch {
    return;
  }
  const lines = existing.split("\n").filter((l) => !l.includes(MARKER));
  const newCrontab = lines.filter((l) => l.trim() !== "").join("\n") + "\n";
  execSync(`echo '${newCrontab}' | crontab -`, { encoding: "utf-8" });
}

async function getStatus(): Promise<string | null> {
  const os = platform();
  if (os === "darwin") {
    try {
      const content = await readFile(PLIST_PATH, "utf-8");
      const hourMatch = content.match(/<key>Hour<\/key>\s*<integer>(\d+)<\/integer>/);
      const minMatch = content.match(/<key>Minute<\/key>\s*<integer>(\d+)<\/integer>/);
      if (hourMatch && minMatch) {
        const h = hourMatch[1].padStart(2, "0");
        const m = minMatch[1].padStart(2, "0");
        return `${h}:${m}`;
      }
    } catch {
      return null;
    }
  } else {
    try {
      const crontab = execSync("crontab -l 2>/dev/null", { encoding: "utf-8" });
      const line = crontab.split("\n").find((l) => l.includes("# beacon-schedule"));
      if (line) {
        const parts = line.trim().split(/\s+/);
        const h = parts[1].padStart(2, "0");
        const m = parts[0].padStart(2, "0");
        return `${h}:${m}`;
      }
    } catch {
      return null;
    }
  }
  return null;
}

function parseTime(time: string): { hour: number; minute: number } | null {
  const match = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = parseInt(match[1], 10);
  const minute = parseInt(match[2], 10);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

export async function scheduleCommand(
  action: string,
  time?: string
): Promise<void> {
  const os = platform();

  if (action === "status") {
    const scheduled = await getStatus();
    if (scheduled) {
      console.log(`Beacon is scheduled to run daily at ${chalk.bold(scheduled)}.`);
    } else {
      console.log("No schedule configured. Run 'beacon schedule set HH:MM' to set one.");
    }
    return;
  }

  if (action === "off") {
    if (os === "darwin") {
      await removeScheduleMacOS();
    } else {
      await removeScheduleLinux();
    }
    console.log(chalk.green("Schedule removed."));
    return;
  }

  if (action === "set") {
    if (!time) {
      console.error("Usage: beacon schedule set HH:MM");
      process.exit(1);
    }

    const parsed = parseTime(time);
    if (!parsed) {
      console.error("Invalid time format. Use HH:MM (e.g., 09:00).");
      process.exit(1);
    }

    if (os === "darwin") {
      await setScheduleMacOS(parsed.hour, parsed.minute);
    } else if (os === "linux") {
      await setScheduleLinux(parsed.hour, parsed.minute);
    } else {
      console.error(`Scheduling is not supported on ${os}. Supported: macOS, Linux.`);
      process.exit(1);
    }

    const timeStr = `${String(parsed.hour).padStart(2, "0")}:${String(parsed.minute).padStart(2, "0")}`;
    console.log(chalk.green(`Scheduled! Beacon will run daily at ${timeStr}.`));
    return;
  }

  console.error("Unknown action. Use: beacon schedule set|off|status");
  process.exit(1);
}
