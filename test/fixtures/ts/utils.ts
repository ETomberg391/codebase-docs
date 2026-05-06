/**
 * Utility functions for string manipulation.
 */

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + '...';
}

export interface Config {
  name: string;
  maxItems: number;
  debug: boolean;
}

export class Formatter {
  private config: Config;

  constructor(config: Config) {
    this.config = config;
  }

  format(input: string): string {
    return capitalize(truncate(input, this.config.maxItems));
  }
}
