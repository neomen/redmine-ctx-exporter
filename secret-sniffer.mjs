// src/patterns.js
var define = (id, label, regex, secretGroup = 0) => Object.freeze({ id, label, regex, secretGroup });
var DEFAULT_PATTERNS = Object.freeze([
  // Generic credential assignments. Match the whole assignment so the key is
  // removed together with its value and cannot be accidentally left in logs.
  define(
    "generic.password",
    "Password or secret assignment",
    /(?:^|[^A-Za-z0-9_])(?:passphrase|password|passwd|пароль|pass|pwd|secret|auth|api[_-]?secret|client[_-]?secret|api[_-]?key|private[_-]?key|access[_-]?token|refresh[_-]?token|ключ)\s*[:=]\s*(?:"[^"\r\n]{4,}"|'[^'\r\n]{4,}'|[^\s,;"']{4,})/i
  ),
  define(
    "generic.email-password-pair",
    "Email and Password Pair",
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b(?:[ \t]*[:;|/ ][ \t]*|\r?\n[ \t]*)([^\s]{6,128})/i
  ),
  define(
    "generic.authorization",
    "Authorization header",
    /(?:\bAuthorization\s*:\s*)(?:Basic|Bearer)\s+[^\s,;]+/i
  ),
  define(
    "generic.bearer-token",
    "Bearer token",
    /\bBearer\s+([A-Za-z0-9_~+/.=-]{8,})/i,
    1
  ),
  define(
    "generic.basic-auth-url",
    "Credentials in URL",
    /\b[a-z][a-z0-9+.-]{1,15}:\/\/[^\s/@:]+:[^\s/@]+@[^\s]+/i
  ),
  define(
    "db.uri-password",
    "Database URI credentials",
    /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|rediss|amqp|mssql):\/\/[^\s/@:]+:[^\s/@]+@[^\s]+/i
  ),
  define(
    "generic.cookie-header",
    "Cookie or set-cookie header",
    /(?:\b(?:Cookie|Set-Cookie)\s*:\s*)[^\r\n]+/i
  ),
  // Cloud provider credentials.
  define("aws.access-key", "AWS access key ID", /\b(?:AKIA|ASIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASCA)[0-9A-Z]{16}\b/),
  define(
    "aws.secret-key",
    "AWS secret access key",
    /\b(?:aws_secret_access_key|aws_secret_key|secret_access_key)\s*[:=]\s*["']?([A-Za-z0-9/+=]{40})["']?/i,
    1
  ),
  define("google.api-key", "Google API key", /\bAIza[0-9A-Za-z_-]{35}\b/),
  define("google.oauth-token", "Google OAuth refresh token", /\b1\/\/0[0-9A-Za-z_-]{43,}\b/),
  define(
    "azure.storage-key",
    "Azure Storage account key",
    /\b(?:AccountKey|account_key)\s*=\s*["']?([A-Za-z0-9+/]{80,90}={0,2})["']?/i,
    1
  ),
  // AI and SaaS providers.
  define("openai.project-key", "OpenAI project key", /\bsk-proj-[A-Za-z0-9_-]{20,}\b/),
  define("openai.legacy-key", "OpenAI API key", /\bsk-[A-Za-z0-9]{40,64}\b/),
  define("anthropic.key", "Anthropic API key", /\bsk-ant-(?:api|admin)\d{2}-[A-Za-z0-9_-]{40,}\b/),
  define("github.token", "GitHub token", /\bgh[pousr]_[A-Za-z0-9]{30,255}\b/),
  define("github.fine-grained", "GitHub fine-grained token", /\bgithub_pat_[A-Za-z0-9_]{50,}\b/),
  define("gitlab.pat", "GitLab personal access token", /\bglpat-[A-Za-z0-9_-]{20,}\b/),
  define("stripe.live-secret", "Stripe live secret key", /\b(?:sk|rk)_live_[A-Za-z0-9]{20,}\b/),
  define("stripe.test-secret", "Stripe test secret key", /\b(?:sk|rk)_test_[A-Za-z0-9]{20,}\b/),
  define("slack.token", "Slack token", /\bxox[abopsr]-[A-Za-z0-9-]{20,}\b/),
  define("slack.webhook", "Slack webhook URL", /https:\/\/hooks\.slack\.com\/services\/[A-Z0-9]+\/[A-Z0-9]+\/[A-Za-z0-9]+/),
  define("twilio.account-sid", "Twilio account SID", /\bAC[a-f0-9]{32}\b/),
  define("twilio.api-key", "Twilio API key", /\bSK[a-f0-9]{32}\b/),
  define("sendgrid.api-key", "SendGrid API key", /\bSG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}\b/),
  define("mailgun.key", "Mailgun API key", /\bkey-[a-f0-9]{32}\b/i),
  define("npm.token", "npm token", /\bnpm_[A-Za-z0-9]{30,}\b/),
  define("pypi.token", "PyPI upload token", /\bpypi-AgEIcHlwaS5vcmc[A-Za-z0-9_-]{30,}\b/),
  define("cloudflare.api-token", "Cloudflare API token", /\b(?:Cf|cf)-[A-Za-z0-9_-]{30,}\b/),
  define("square.token", "Square access token", /\bsq0i[ac]p-[0-9A-Za-z_-]{30,}\b/),
  define("newrelic.api-key", "New Relic API key", /\bNRAK-[A-Z0-9]{20,}\b/),
  define("shopify.token", "Shopify access token", /\bshp(?:ss|ca|at|pa)_[a-fA-F0-9]{32}\b/),
  // Cryptographic material and common token formats.
  define("jwt", "JSON Web Token", /\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/),
  define(
    "pem.private-key",
    "PEM private key block",
    /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP |ENCRYPTED |)PRIVATE KEY-----[\s\S]+?-----END (?:RSA |EC |OPENSSH |DSA |PGP |ENCRYPTED |)PRIVATE KEY-----/
  ),
  define("ssh.private-key-header", "SSH private key header", /-----BEGIN OPENSSH PRIVATE KEY-----/)
]);

// src/utils.js
var DEFAULT_REPLACEMENT = "[REDACTED]";
function cloneRegExp(regex) {
  if (!(regex instanceof RegExp)) {
    throw new TypeError("Each pattern.regex must be a RegExp");
  }
  const flags = [...new Set(`${regex.flags.replace(/[gy]/g, "")}g`)].join("");
  return new RegExp(regex.source, flags);
}
function getCaptureRange(match, groupIndex) {
  if (!groupIndex) {
    return { index: match.index, length: match[0].length };
  }
  const value = match[groupIndex];
  if (typeof value !== "string" || value.length === 0) return null;
  const offset = match[0].indexOf(value);
  if (offset < 0) return null;
  return { index: match.index + offset, length: value.length };
}
function getIgnoredRanges(text, options = {}) {
  const ranges = [];
  if (options.ignoreCodeBlocks) {
    const lines = text.split(/(?<=\n)/);
    let absolute = 0;
    let open = null;
    for (const line of lines) {
      const content = line.replace(/\r?\n$/, "");
      const fence = content.match(/^ {0,3}(`{3,}|~{3,})/);
      if (!open && fence) {
        open = { start: absolute, char: fence[1][0], length: fence[1].length };
      } else if (open) {
        const close = content.match(/^ {0,3}(`+|~+)/);
        if (close && close[1][0] === open.char && close[1].length >= open.length) {
          ranges.push({ start: open.start, end: absolute + line.length });
          open = null;
        }
      }
      absolute += line.length;
    }
    if (open) ranges.push({ start: open.start, end: text.length });
    const inline = /(`+)([^`\n]|\n)*?\1/g;
    let match;
    while ((match = inline.exec(text)) !== null) {
      ranges.push({ start: match.index, end: match.index + match[0].length });
    }
  }
  if (options.ignoreComments) {
    const comments = /<!--[\s\S]*?-->/g;
    let match;
    while ((match = comments.exec(text)) !== null) {
      ranges.push({ start: match.index, end: match.index + match[0].length });
    }
  }
  return ranges.sort((a, b) => a.start - b.start);
}
function overlapsIgnoredRange(index, length, ranges) {
  const end = index + length;
  return ranges.some((range) => index < range.end && end > range.start);
}
function mergeOverlappingFindings(findings) {
  if (!findings.length) return [];
  const sorted = [...findings].sort((a, b) => a.index - b.index || b.length - a.length);
  const groups = [];
  for (const finding of sorted) {
    const current = groups[groups.length - 1];
    const end = finding.index + finding.length;
    if (!current || finding.index >= current.end) {
      groups.push({ start: finding.index, end, findings: [finding] });
    } else {
      current.end = Math.max(current.end, end);
      current.findings.push(finding);
    }
  }
  return groups;
}

// src/scanner.js
function validatePatterns(patterns) {
  if (!Array.isArray(patterns)) throw new TypeError("options.patterns must be an array");
  for (const pattern of patterns) {
    if (!pattern || typeof pattern.id !== "string" || typeof pattern.label !== "string") {
      throw new TypeError("Each pattern must have string id and label properties");
    }
    if (!(pattern.regex instanceof RegExp)) throw new TypeError(`Pattern ${pattern.id} must have a RegExp in regex`);
  }
}
function scan(text, options = {}) {
  if (typeof text !== "string") throw new TypeError("scan() expects a string");
  if (text.length === 0) return { found: false, findings: [] };
  const patterns = options.patterns ?? DEFAULT_PATTERNS;
  validatePatterns(patterns);
  const ignoredRanges = getIgnoredRanges(text, options);
  const findings = [];
  for (const pattern of patterns) {
    const regex = cloneRegExp(pattern.regex);
    let match;
    while ((match = regex.exec(text)) !== null) {
      const range = getCaptureRange(match, pattern.secretGroup ?? 0);
      if (range && range.length > 0 && !overlapsIgnoredRange(range.index, range.length, ignoredRanges)) {
        findings.push(Object.freeze({
          patternId: pattern.id,
          label: pattern.label,
          index: range.index,
          length: range.length
        }));
      }
      if (match[0].length === 0) regex.lastIndex += 1;
    }
  }
  findings.sort((a, b) => a.index - b.index || b.length - a.length);
  return { found: findings.length > 0, findings };
}
function contains(text, options = {}) {
  if (typeof text !== "string") throw new TypeError("contains() expects a string");
  if (text.length === 0) return false;
  const patterns = options.patterns ?? DEFAULT_PATTERNS;
  validatePatterns(patterns);
  const ignoredRanges = getIgnoredRanges(text, options);
  for (const pattern of patterns) {
    const regex = cloneRegExp(pattern.regex);
    let match;
    while ((match = regex.exec(text)) !== null) {
      const range = getCaptureRange(match, pattern.secretGroup ?? 0);
      if (range && range.length > 0 && !overlapsIgnoredRange(range.index, range.length, ignoredRanges)) {
        return true;
      }
      if (match[0].length === 0) regex.lastIndex += 1;
    }
  }
  return false;
}
function redact(text, options = {}) {
  const result = scan(text, options);
  if (!result.found) return text;
  const replacement = options.replacement ?? DEFAULT_REPLACEMENT;
  const groups = mergeOverlappingFindings(result.findings);
  let output = text;
  for (let i = groups.length - 1; i >= 0; i -= 1) {
    const group = groups[i];
    const primary = [...group.findings].sort((a, b) => b.length - a.length || a.patternId.localeCompare(b.patternId))[0];
    const finding = Object.freeze({ ...primary, index: group.start, length: group.end - group.start });
    const value = typeof replacement === "function" ? replacement(finding) : replacement;
    if (typeof value !== "string") throw new TypeError("replacement function must return a string");
    output = output.slice(0, group.start) + value + output.slice(group.end);
  }
  return output;
}
function sanitizeText(text, options = {}) {
  return redact(text, options);
}

// src/structured.js
var SENSITIVE_KEY = /(?:^|[_-])(?:password|passwd|pwd|secret|api[_-]?key|private[_-]?key|access[_-]?token|refresh[_-]?token|auth(?:orization)?|credential|client[_-]?secret|cookie|session[_-]?id|token)(?:$|[_-])/i;
var SENSITIVE_COMPACT = /^(?:password|passwd|pwd|secret|apikey|privatekey|accesstoken|refreshtoken|authorization|auth|credential|credentials|clientsecret|cookie|setcookie|sessionid|token)$/i;
function isSensitiveKey(key) {
  if (typeof key !== "string") return false;
  const normalized = key.replace(/[\s_-]/g, "").toLowerCase();
  return SENSITIVE_KEY.test(key) || SENSITIVE_COMPACT.test(normalized);
}
function isPlainObject(value) {
  if (value === null || typeof value !== "object") return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
function sanitizeStructured(value, options = {}, seen = /* @__PURE__ */ new WeakMap()) {
  if (typeof value === "string") return redact(value, options);
  if (value === null || typeof value !== "object") return value;
  if (seen.has(value)) return seen.get(value);
  if (Array.isArray(value)) {
    const output2 = [];
    seen.set(value, output2);
    for (const item of value) output2.push(sanitizeStructured(item, options, seen));
    return output2;
  }
  if (!isPlainObject(value)) return value;
  const output = Object.create(Object.getPrototypeOf(value));
  seen.set(value, output);
  for (const key of Object.keys(value)) {
    const item = value[key];
    output[key] = isSensitiveKey(key) ? "[REDACTED]" : sanitizeStructured(item, options, seen);
  }
  return output;
}

// src/sanitizer.js
function countFindings(value, options, seen = /* @__PURE__ */ new WeakSet()) {
  if (typeof value === "string") return scan(value, options).findings.length;
  if (value === null || typeof value !== "object" || seen.has(value)) return 0;
  seen.add(value);
  let count = 0;
  if (Array.isArray(value)) {
    for (const item of value) count += countFindings(item, options, seen);
    return count;
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return 0;
  for (const key of Object.keys(value)) {
    if (isSensitiveKey(key)) count += 1;
    else count += countFindings(value[key], options, seen);
  }
  return count;
}
function sanitize(value, options = {}) {
  return sanitizeStructured(value, options);
}
function sanitizeWithReport(value, options = {}) {
  const findingsCount = countFindings(value, options);
  return {
    value: sanitize(value, options),
    report: {
      found: findingsCount > 0,
      findingsCount
    }
  };
}
export {
  DEFAULT_PATTERNS,
  contains,
  isSensitiveKey,
  redact,
  sanitize,
  sanitizeText,
  sanitizeWithReport,
  scan
};
//# sourceMappingURL=secret-sniffer.mjs.map
