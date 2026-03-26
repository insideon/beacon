const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export function createSpinner() {
  let interval: ReturnType<typeof setInterval> | null = null;
  let frameIndex = 0;
  let startTime = 0;

  return {
    start(message: string) {
      frameIndex = 0;
      startTime = Date.now();
      process.stderr.write(`${FRAMES[0]} ${message}`);
      interval = setInterval(() => {
        frameIndex = (frameIndex + 1) % FRAMES.length;
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
        process.stderr.write(`\r${FRAMES[frameIndex]} ${message} (${elapsed}s)`);
      }, 80);
    },
    succeed(message: string) {
      if (interval) clearInterval(interval);
      process.stderr.write(`\r✔ ${message}\n`);
    },
    fail(message: string) {
      if (interval) clearInterval(interval);
      process.stderr.write(`\r✖ ${message}\n`);
    },
  };
}
