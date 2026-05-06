import { parse as parseTypeScript } from './typescript.js';
import { parse as parsePython } from './python.js';
import { parse as parseGo } from './go.js';
/**
 * Parses a code file using the appropriate language parser.
 */
export function parse(file) {
    switch (file.language) {
        case 'typescript':
        case 'javascript':
            return parseTypeScript(file);
        case 'python':
            return parsePython(file);
        case 'go':
            return parseGo(file);
        default:
            return {
                path: file.path,
                language: file.language,
                symbols: [],
                imports: [],
                exports: [],
                content: file.content,
            };
    }
}
//# sourceMappingURL=index.js.map