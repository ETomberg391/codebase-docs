# codebase-docs

Generate an interactive, self-contained HTML documentation site from any codebase. One command produces a browsable file with a file tree, dependency graph, and searchable symbols — no server required.

## Install

```bash
npm install -g codebase-docs
```

Or run directly with npx:

```bash
npx codebase-docs /path/to/repo
```

## Usage

```bash
codebase-docs [target] [options]
```

| Argument | Description |
|---|---|
| `target` | Path to the codebase root (default: current directory) |

| Option | Description |
|---|---|
| `-o, --output` | Output file path (default: `docs.html`) |
| `-t, --title` | Document title (default: `Codebase Documentation`) |
| `--theme` | Color theme: `dark` or `light` (default: `dark`) |
| `--lang` | Language filter; repeat for multiple (e.g. `--lang typescript --lang python`) |
| `-h, --help` | Show help |
| `-v, --version` | Show version |

### Examples

```bash
# Generate docs for the current directory
codebase-docs

# Target a specific project with a custom output file and light theme
codebase-docs /path/to/repo -o docs.html --theme light

# Filter to specific languages
codebase-docs . --lang typescript --lang python
```

## Supported Languages

- TypeScript / JavaScript
- Python
- Go

## Output

The tool produces a single HTML file that opens in any browser. It includes:

- **File tree navigation** — browse the project structure
- **Module cards** — each module shows its exports and dependencies
- **Dependency graph** — interactive visualization of module relationships
- **Symbol search** — find any function, class, type, or variable
- **Code snippets** — click a symbol to see its source definition

## Pipeline

```
scan → parse → analyze → generate
```

1. **Scan** — walks the target directory, detects file languages, filters by extension
2. **Parse** — extracts symbols (functions, classes, interfaces, types, variables, constants, enums), imports, and exports from each file
3. **Analyze** — resolves import references between modules, builds a dependency graph, computes module metrics
4. **Generate** — renders everything into a self-contained HTML document with embedded styles and scripts

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Run against a target
npm run dev -- /path/to/repo
```

## Requirements

- Node.js 18+

## License

MIT
