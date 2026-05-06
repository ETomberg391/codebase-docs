#!/usr/bin/env node
import * as fs from 'node:fs';
import * as path from 'node:path';
import { scanDirectory } from './scanner.js';
import { parse } from './parser/index.js';
import { analyze } from './analyzer.js';
import { generate } from './generator.js';
function parseArgs(argv) {
    const args = { help: false, version: false };
    for (let i = 2; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--help' || arg === '-h') {
            args.help = true;
        }
        else if (arg === '--version' || arg === '-v') {
            args.version = true;
        }
        else if (arg === '--output' || arg === '-o') {
            args.output = argv[++i];
        }
        else if (arg === '--title' || arg === '-t') {
            args.title = argv[++i];
        }
        else if (arg === '--theme') {
            args.theme = argv[++i];
        }
        else if (arg === '--lang') {
            const lang = argv[++i];
            if (!args.languages)
                args.languages = [];
            args.languages.push(lang);
        }
        else if (!arg.startsWith('-')) {
            args.target = arg;
        }
    }
    return args;
}
function printHelp() {
    console.log(`
codebase-docs - Interactive codebase documentation generator

USAGE
  codebase-docs [target] [options]

ARGUMENTS
  target        Path to the codebase root directory (default: current directory)

OPTIONS
  -o, --output  Output file path (default: docs.html)
  -t, --title   Document title (default: Codebase Documentation)
      --theme   Color theme: dark or light (default: dark)
      --lang    Language filter (can be repeated): typescript, javascript, python, go
  -h, --help    Show this help message
  -v, --version Show version

EXAMPLES
  codebase-docs ./my-project
  codebase-docs /path/to/repo -o docs.html --theme light
  codebase-docs . --lang typescript --lang python
`);
}
class ProgressSpinner {
    frameIndex = 0;
    frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    message = '';
    interval = null;
    start(message) {
        this.message = message;
        process.stdout.write(`\r  ${this.frames[0]} ${message}\n`);
        this.interval = setInterval(() => {
            this.frameIndex = (this.frameIndex + 1) % this.frames.length;
            process.stdout.write(`\r\u001b[K  ${this.frames[this.frameIndex]} ${message}\r`);
        }, 80);
    }
    update(message) {
        this.message = message;
        if (this.interval) {
            clearInterval(this.interval);
        }
        process.stdout.write(`\r\u001b[K  ${this.frames[this.frameIndex]} ${message}\r`);
        this.interval = setInterval(() => {
            this.frameIndex = (this.frameIndex + 1) % this.frames.length;
            process.stdout.write(`\r\u001b[K  ${this.frames[this.frameIndex]} ${message}\r`);
        }, 80);
    }
    stop(result) {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        const suffix = result ? ` — ${result}` : '';
        process.stdout.write(`\r\u001b[K  ✓ ${this.message}${suffix}\n`);
    }
}
function printVersion() {
    const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url).pathname, 'utf-8'));
    console.log(pkg.version);
}
async function main() {
    const args = parseArgs(process.argv);
    if (args.help) {
        printHelp();
        process.exit(0);
    }
    if (args.version) {
        printVersion();
        process.exit(0);
    }
    const targetPath = args.target || '.';
    const resolvedPath = path.resolve(targetPath);
    // Check if target exists
    if (!fs.existsSync(resolvedPath)) {
        console.error(`Error: Path '${resolvedPath}' does not exist`);
        process.exit(1);
    }
    if (!fs.statSync(resolvedPath).isDirectory()) {
        console.error(`Error: '${resolvedPath}' is not a directory`);
        process.exit(1);
    }
    // Scan
    const spinner = new ProgressSpinner();
    spinner.start(`Scanning ${resolvedPath}...`);
    const scanOptions = {};
    if (args.languages && args.languages.length > 0) {
        scanOptions.languages = args.languages;
    }
    const files = scanDirectory(resolvedPath, scanOptions);
    if (files.length === 0) {
        spinner.stop();
        console.error('Error: No supported source files found');
        console.error('Supported languages: TypeScript, JavaScript, Python, Go');
        process.exit(1);
    }
    spinner.stop(`${files.length} files found`);
    // Parse
    spinner.start('Parsing files...');
    const modules = [];
    for (let i = 0; i < files.length; i++) {
        modules.push(parse(files[i]));
        if ((i + 1) % 50 === 0 || i === files.length - 1) {
            spinner.update(`Parsing files... (${i + 1}/${files.length})`);
        }
    }
    const totalSymbols = modules.reduce((sum, m) => sum + m.symbols.length, 0);
    spinner.stop(`${modules.length} modules, ${totalSymbols} symbols`);
    // Analyze
    spinner.start('Analyzing dependencies...');
    const result = analyze(modules, { basePath: resolvedPath });
    spinner.stop(`${result.summary.totalDependencies} dependencies found`);
    // Generate
    spinner.start('Generating documentation...');
    const genOptions = {
        outputPath: args.output || 'docs.html',
        title: args.title || 'Codebase Documentation',
        theme: args.theme || 'dark',
    };
    const outputPath = generate(result, genOptions);
    spinner.stop();
    console.log(`\nDone! Open ${path.resolve(outputPath)} in your browser.\n`);
}
main().catch(err => {
    console.error('Error:', err.message || err);
    process.exit(1);
});
//# sourceMappingURL=cli.js.map