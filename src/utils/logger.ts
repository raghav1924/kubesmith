export const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
  gray: '\x1b[90m',
};

export class Logger {
  public static info(msg: string): void {
    console.log(`${colors.cyan}ℹ${colors.reset} ${msg}`);
  }

  public static success(msg: string): void {
    console.log(`${colors.green}✔${colors.reset} ${msg}`);
  }

  public static warn(msg: string): void {
    console.log(`${colors.yellow}⚠${colors.reset} ${msg}`);
  }

  public static error(msg: string): void {
    console.log(`${colors.red}✖${colors.reset} ${msg}`);
  }

  public static header(title: string): void {
    console.log(`\n${colors.bold}${colors.cyan}=== ${title} ===${colors.reset}\n`);
  }
}
