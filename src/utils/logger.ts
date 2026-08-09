/**
 * Centralized Logger for EchoBook
 * Provides structured, tagged logging with timestamps across debug, info, warn, and error levels.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
  private formatPrefix(level: LogLevel, tag?: string): string {
    const timestamp = new Date().toISOString().substring(11, 19);
    const tagStr = tag ? `[${tag}]` : '';
    return `[${timestamp}] [${level.toUpperCase()}]${tagStr}`;
  }

  debug(message: string, tag?: string, ...args: any[]) {
    if (__DEV__) {
      console.log(this.formatPrefix('debug', tag), message, ...args);
    }
  }

  info(message: string, tag?: string, ...args: any[]) {
    console.log(this.formatPrefix('info', tag), message, ...args);
  }

  warn(message: string, tag?: string, ...args: any[]) {
    console.warn(this.formatPrefix('warn', tag), message, ...args);
  }

  error(message: string, tag?: string, error?: unknown, ...args: any[]) {
    console.error(this.formatPrefix('error', tag), message, error ?? '', ...args);
  }
}

export const logger = new Logger();
