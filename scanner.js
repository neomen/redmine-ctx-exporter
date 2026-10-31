// scanner.js
// Wrapper over secret-sniffer.mjs. It does not contain its own search logic —
// only routing modes and adding custom patterns.

import { scan, redact, DEFAULT_PATTERNS } from './secret-sniffer.mjs';

const CUSTOM_PATTERNS = [];

/**
 * Scans the finished text (Markdown or JSON).
 *
 * @param {string} text
 * @param {object} options
 * @param {'warn'|'redact'|'off'} [options.mode='warn']
 *   - warn — return the finds, do not change the text (the calling code asks the user);
 *   - redact — replace found secrets with [REDACTED];
 *   - off    — do not scan.
 * @param {Array}  [options.extraPatterns=[]]  — additional patterns on top of DEFAULT_PATTERNS;
 * @param {boolean} [options.ignoreCodeBlocks=false] — do not scan the fenced/inline code;
 * @param {boolean} [options.ignoreComments=false]   — do not scan <!-- HTML comments -->.
 *
 * @returns {{
 *   clean: boolean,
 *   mode: 'warn'|'redact'|'off',
 *   findings: Array<{patternId:string,label:string,index:number,length:number}>,
 *   output: string
 * }}
 */
export function scanText(text, options = {}) {
  const {
    mode = 'warn',
    extraPatterns = [],
    ignoreCodeBlocks = false,
    ignoreComments = false
  } = options;

  if (mode === 'off' || !text) {
    return { clean: true, mode: 'off', findings: [], output: text };
  }

  // IMPORTANT: options.patterns in secret-sniffer COMPLETELY replaces defaults,
  // therefore, we glue DEFAULT_PATTERNS + CUSTOM_PATTERNS + extraPatterns.
  const patterns = [...DEFAULT_PATTERNS, ...CUSTOM_PATTERNS, ...extraPatterns];
  const scanOpts = { patterns, ignoreCodeBlocks, ignoreComments };

  const result = scan(text, scanOpts);

  if (!result.found) {
    return { clean: true, mode, findings: [], output: text };
  }

  if (mode === 'redact') {
    // By default, the library substitutes "[REDACTED]".
    // If you want to see WHAT was cut, uncomment the replacement:
    const output = redact(text, scanOpts);
    // const output = redact(text, {
    //   ...scanOpts,
    //   replacement: (f) => `[REDACTED:${f.patternId}]`
    // });
    return { clean: false, mode: 'redact', findings: result.findings, output };
  }

  // mode === 'warn'
  return { clean: false, mode: 'warn', findings: result.findings, output: text };
}