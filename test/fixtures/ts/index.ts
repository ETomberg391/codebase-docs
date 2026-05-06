import { capitalize, truncate, Formatter } from './utils';

export function greet(name: string): string {
  return `Hello, ${capitalize(name)}!`;
}

export function processInput(input: string): string {
  return truncate(input, 50);
}

export const VERSION = '1.0.0';
