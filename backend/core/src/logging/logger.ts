import { inject, injectable } from 'inversify';
import { AppConfig } from '../config/app-config.js';
import { CoreToken } from '../di/core-token.enum.js';
import { LogLevel } from '../enums/core.enums.js';

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  [LogLevel.DEBUG]: 10,
  [LogLevel.INFO]: 20,
  [LogLevel.WARN]: 30,
  [LogLevel.ERROR]: 40,
};

/** Logger JSON de una línea (formato amigable para CloudWatch). */
@injectable()
export class Logger {
  private readonly minWeight: number;

  constructor(@inject(CoreToken.Config) private readonly config: AppConfig) {
    this.minWeight = LEVEL_WEIGHT[config.logLevel] ?? LEVEL_WEIGHT[LogLevel.INFO];
  }

  debug(message: string, data?: Record<string, unknown>): void {
    this.write(LogLevel.DEBUG, message, data);
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.write(LogLevel.INFO, message, data);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.write(LogLevel.WARN, message, data);
  }

  error(message: string, data?: Record<string, unknown>): void {
    this.write(LogLevel.ERROR, message, data);
  }

  private write(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    if (LEVEL_WEIGHT[level] < this.minWeight) return;
    const line = JSON.stringify({
      level,
      time: new Date().toISOString(),
      service: this.config.serviceName,
      message,
      ...data,
    });
    if (level === LogLevel.ERROR) console.error(line);
    else console.log(line);
  }
}
