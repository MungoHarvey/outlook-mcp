/**
 * sanitize.js — Neutralise untrusted message content before it reaches the model.
 *
 * Port of scripts/sanitize.py. Node has no built-in HTML parser, so this
 * carries a small tokenizer modelled on Python's html.parser (tags, quoted
 * attributes, comments, declarations, raw-text <script>/<style>, character
 * references). Both implementations must pass the shared cases in
 * test/fixtures/sanitize-cases.json.
 *
 * Exports: stripInvisible, htmlToSafeText, sanitizeResponse, BEGIN_MARK, END_MARK
 */

export const BEGIN_MARK = "[BEGIN UNTRUSTED CONTENT]";
export const END_MARK   = "[END UNTRUSTED CONTENT]";

// Zero-width/joiners, bidi overrides/isolates, soft hyphen, fillers, BOM,
// variation selectors and the Unicode tag block (ASCII smuggling).
const INVISIBLE_RE = new RegExp(
  "[\\u00ad\\u034f\\u061c\\u115f\\u1160\\u17b4\\u17b5\\u180b-\\u180f" +
  "\\u200b-\\u200f\\u202a-\\u202e\\u2060-\\u2064\\u2066-\\u206f" +
  "\\u3164\\ufe00-\\ufe0f\\ufeff\\uffa0\\u{e0000}-\\u{e007f}]",
  "gu",
);

export function stripInvisible(text) {
  return text.replace(INVISIBLE_RE, "");
}

const DROP_CONTENT = new Set([
  "script", "style", "head", "title", "noscript", "template", "iframe",
  "object", "embed", "svg", "math", "canvas", "select", "textarea", "button",
]);
const VOID = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input", "link",
  "meta", "param", "source", "track", "wbr",
]);
const BLOCK = new Set([
  "address", "article", "aside", "blockquote", "div", "dl", "dt", "dd",
  "fieldset", "figcaption", "figure", "footer", "form", "h1", "h2", "h3",
  "h4", "h5", "h6", "header", "hr", "li", "main", "nav", "ol", "p", "pre",
  "section", "table", "tr", "ul", "br", "center",
]);
const SELF_CLOSING_SIBLINGS = new Set(["p", "li", "td", "th", "tr", "option", "dt", "dd"]);
const RAW_TEXT = new Set(["script", "style"]); // same as html.parser CDATA_CONTENT_ELEMENTS
const SAFE_SCHEMES = ["http://", "https://", "mailto:"];

const HIDDEN_STYLE_RES = [
  /display\s*:\s*none/,
  /visibility\s*:\s*(hidden|collapse)/,
  /(^|[;\s])opacity\s*:\s*0*(\.0+)?\s*(;|$|!)/,
  /font-size\s*:\s*0*(\.\d+)?(px|pt|em|rem|%)?\s*(;|$|!)/,
  /font-size\s*:\s*(0?\.\d+|1)px/,
  /(^|[;\s])(max-)?(height|width)\s*:\s*0+(px|pt|em|%)?\s*(;|$|!)/,
  /(left|top|right|bottom|text-indent|margin-left|margin-top)\s*:\s*-\d{3,}/,
  /color\s*:\s*transparent/,
  /clip\s*:\s*rect\(\s*0/,
  /clip-path\s*:\s*inset\(\s*(50|100)%/,
  /transform\s*:\s*scale\(\s*0(\.0+)?\s*[,)]/,
];
const COLOR_RE = /(?:^|[;\s])color\s*:\s*([^;!]+)/;
const BG_RE    = /background(?:-color)?\s*:\s*([^;!]+)/;

function normColour(v) {
  const s = v.trim().toLowerCase().replace(/ /g, "");
  const aliases = {
    "#fff": "#ffffff", "white": "#ffffff", "rgb(255,255,255)": "#ffffff",
    "#000": "#000000", "black": "#000000", "rgb(0,0,0)": "#000000",
  };
  return aliases[s] ?? s;
}

function isHidden(tag, attrs) {
  if ("hidden" in attrs) return true;
  if ((attrs["aria-hidden"] || "").trim().toLowerCase() === "true") return true;
  if (tag === "input" && (attrs.type || "").toLowerCase() === "hidden") return true;
  const style = (attrs.style || "").toLowerCase();
  if (style) {
    if (HIDDEN_STYLE_RES.some((r) => r.test(style))) return true;
    const fg = COLOR_RE.exec(style);
    const bg = BG_RE.exec(style);
    if (fg && bg && normColour(fg[1]) === normColour(bg[1])) return true;
  }
  if (attrs.color && attrs.bgcolor && normColour(attrs.color) === normColour(attrs.bgcolor)) {
    return true;
  }
  return false;
}

// ── Character references ────────────────────────────────────────────────────
const NAMED = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  pound: "£", euro: "€", copy: "©", reg: "®",
  trade: "™", hellip: "…", mdash: "—", ndash: "–",
  lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”",
  bull: "•", middot: "·", times: "×", shy: "­",
  zwj: "‍", zwnj: "‌", lrm: "‎", rlm: "‏",
};

function decodeEntities(s) {
  return s.replace(/&(#[xX][0-9a-fA-F]+|#\d+|[a-zA-Z][a-zA-Z0-9]*);?/g, (m, ref) => {
    if (ref[0] === "#") {
      const cp = ref[1] === "x" || ref[1] === "X" ? parseInt(ref.slice(2), 16) : parseInt(ref.slice(1), 10);
      if (!Number.isFinite(cp) || cp <= 0 || cp > 0x10ffff) return "�";
      return String.fromCodePoint(cp);
    }
    const v = NAMED[ref.toLowerCase()];
    return v === undefined ? m : v;
  });
}

// ── Tokenizer ───────────────────────────────────────────────────────────────
// Yields {type:"start"|"end"|"text", tag, attrs, selfClosing, text}.
function* tokenize(html) {
  let i = 0;
  const n = html.length;
  while (i < n) {
    const lt = html.indexOf("<", i);
    if (lt === -1) { yield { type: "text", text: decodeEntities(html.slice(i)) }; return; }
    if (lt > i) yield { type: "text", text: decodeEntities(html.slice(i, lt)) };
    i = lt;
    if (html.startsWith("<!--", i)) {
      const end = html.indexOf("-->", i + 4);
      i = end === -1 ? n : end + 3;
      continue;
    }
    if (html[i + 1] === "!" || html[i + 1] === "?") {
      const end = html.indexOf(">", i);
      i = end === -1 ? n : end + 1;
      continue;
    }
    const isEnd = html[i + 1] === "/";
    const nameStart = i + (isEnd ? 2 : 1);
    if (!/[a-zA-Z]/.test(html[nameStart] || "")) {
      yield { type: "text", text: "<" };
      i += 1;
      continue;
    }
    let j = nameStart;
    while (j < n && !/[\s/>]/.test(html[j])) j++;
    const tag = html.slice(nameStart, j).toLowerCase();

    // Attributes (quoted values may contain ">").
    const attrs = {};
    let selfClosing = false;
    while (j < n && html[j] !== ">") {
      if (/[\s]/.test(html[j])) { j++; continue; }
      if (html[j] === "/") { selfClosing = html[j + 1] === ">"; j++; continue; }
      let k = j;
      while (k < n && !/[\s=/>]/.test(html[k])) k++;
      const name = html.slice(j, k).toLowerCase();
      j = k;
      while (j < n && /\s/.test(html[j])) j++;
      let value = null;
      if (html[j] === "=") {
        j++;
        while (j < n && /\s/.test(html[j])) j++;
        const q = html[j];
        if (q === '"' || q === "'") {
          const close = html.indexOf(q, j + 1);
          value = html.slice(j + 1, close === -1 ? n : close);
          j = close === -1 ? n : close + 1;
        } else {
          k = j;
          while (k < n && !/[\s>]/.test(html[k])) k++;
          value = html.slice(j, k);
          j = k;
        }
      }
      if (name && !(name in attrs)) attrs[name] = value === null ? "" : decodeEntities(value);
    }
    i = j + 1;

    if (isEnd) { yield { type: "end", tag }; continue; }
    yield { type: "start", tag, attrs, selfClosing };

    if (RAW_TEXT.has(tag) && !selfClosing) {
      const re = new RegExp(`</${tag}\\s*>`, "i");
      const m = re.exec(html.slice(i));
      const end = m ? i + m.index : n;
      yield { type: "text", text: html.slice(i, end) };
      i = end;
    }
  }
}

function tidy(text) {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/ /g, " ")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function htmlToSafeText(html) {
  const out = [];
  const stack = []; // {tag, suppress, href}
  const suppressed = () => stack.some((e) => e.suppress);
  const close = (tag) => {
    for (let i = stack.length - 1; i >= 0; i--) {
      if (stack[i].tag === tag) return stack.splice(i)[0];
    }
    return null;
  };

  try {
    for (const t of tokenize(html)) {
      if (t.type === "text") {
        if (!suppressed()) out.push(t.text);
      } else if (t.type === "start") {
        const { tag, attrs } = t;
        if (SELF_CLOSING_SIBLINGS.has(tag) && stack.length && stack[stack.length - 1].tag === tag) {
          close(tag);
        }
        if (BLOCK.has(tag) && !suppressed()) out.push("\n");
        if (VOID.has(tag) || t.selfClosing) continue;
        const suppress = DROP_CONTENT.has(tag) || isHidden(tag, attrs);
        let href = null;
        if (tag === "a") {
          const raw = stripInvisible(attrs.href || "").trim();
          if (SAFE_SCHEMES.some((s) => raw.toLowerCase().startsWith(s))) href = raw;
        }
        stack.push({ tag, suppress, href });
      } else {
        const wasSuppressed = suppressed();
        const closed = close(t.tag);
        if (closed === null || (wasSuppressed && suppressed())) continue;
        if (closed.suppress) continue;
        if (closed.href) out.push(` <${closed.href}>`);
        if (BLOCK.has(t.tag)) out.push("\n");
      }
    }
  } catch {
    return ""; // fail closed
  }
  return tidy(stripInvisible(out.join("")));
}

function wrap(text) {
  const clean = text.split(BEGIN_MARK).join("").split(END_MARK).join("");
  return `${BEGIN_MARK}\n${clean}\n${END_MARK}`;
}

function sanitizeItemBody(body) {
  if (typeof body.content !== "string") return body;
  const text = String(body.contentType || "").toLowerCase() === "html"
    ? htmlToSafeText(body.content)
    : tidy(stripInvisible(body.content));
  return { ...body, contentType: "text", content: text ? wrap(text) : "" };
}

/**
 * Return a sanitised copy of a Graph JSON response: every itemBody becomes
 * wrapped visible text; every other string loses invisible code points.
 */
export function sanitizeResponse(data) {
  if (Array.isArray(data)) return data.map(sanitizeResponse);
  if (data && typeof data === "object") {
    if ("contentType" in data && "content" in data) return sanitizeItemBody(data);
    return Object.fromEntries(Object.entries(data).map(([k, v]) => [k, sanitizeResponse(v)]));
  }
  if (typeof data === "string") return stripInvisible(data);
  return data;
}
