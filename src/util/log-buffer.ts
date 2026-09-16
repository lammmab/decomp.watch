import { snooplogg } from "snooplogg";

const MAX_LOGS = 500;

interface LogEntry {
  timestamp: Date;
  level: string;
  message: string;
}

class LogBuffer {
  private logs: LogEntry[] = [];
  private snoop = snooplogg("decomp");

  private addLog(level: string, ...args: unknown[]) {
    const message = args
      .map((arg) => (typeof arg === "string" ? arg : JSON.stringify(arg)))
      .join(" ");
    this.logs.push({
      timestamp: new Date(),
      level,
      message,
    });

    if (this.logs.length > MAX_LOGS) {
      this.logs.shift();
    }
  }

  info(...args: unknown[]) {
    this.addLog("INFO", ...args);
    this.snoop.info(...args);
  }

  warn(...args: unknown[]) {
    this.addLog("WARN", ...args);
    this.snoop.warn(...args);
  }

  error(...args: unknown[]) {
    this.addLog("ERROR", ...args);
    this.snoop.error(...args);
  }

  debug(...args: unknown[]) {
    this.addLog("DEBUG", ...args);
    this.snoop.debug(...args);
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  clear() {
    this.logs = [];
  }
}

export const logger = new LogBuffer();
export type { LogEntry };
