/**
 * sanitize.js — Neutralise untrusted message content before it reaches the model.
 *
 * Port of scripts/sanitize.py — keep the two in step; both must pass the
 * shared cases in test/fixtures/sanitize-cases.json. Node has no built-in
 * HTML parser, so this carries a small tokenizer modelled on Python's
 * html.parser (tags, first-wins attributes, comments incl. "<!-->" and
 * "--!>", bogus end tags, raw-text elements, full HTML5 character references).
 *
 * Design rule: when in doubt, hide.
 *
 * Exports: stripInvisible, htmlToSafeText, sanitizeResponse, removeMarkers,
 *          BEGIN_MARK, END_MARK
 */

import { HTML5_ENTITIES } from "./html-entities.js";

export const BEGIN_MARK = "[BEGIN UNTRUSTED CONTENT]";
export const END_MARK   = "[END UNTRUSTED CONTENT]";
const MARK_RE = /\[\s*(?:begin|end)\s+untrusted\s+content\s*\]/gi;

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
  "noembed", "noframes", "xmp",
]);
const RAW_TEXT = new Set(["script", "style", "iframe", "noembed", "noframes",
  "noscript", "title", "textarea", "xmp"]);
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
const SAFE_SCHEMES = ["http://", "https://", "mailto:"];

// ── Character references (mirrors Python's html.unescape) ──────────────────
const INVALID_CHARREFS = {
  0x00: "�", 0x0d: "\r", 0x80: "€", 0x81: "\x81", 0x82: "‚",
  0x83: "ƒ", 0x84: "„", 0x85: "…", 0x86: "†", 0x87: "‡",
  0x88: "ˆ", 0x89: "‰", 0x8a: "Š", 0x8b: "‹", 0x8c: "Œ",
  0x8d: "\x8d", 0x8e: "Ž", 0x8f: "\x8f", 0x90: "\x90", 0x91: "‘",
  0x92: "’", 0x93: "“", 0x94: "”", 0x95: "•", 0x96: "–",
  0x97: "—", 0x98: "˜", 0x99: "™", 0x9a: "š", 0x9b: "›",
  0x9c: "œ", 0x9d: "\x9d", 0x9e: "ž", 0x9f: "Ÿ",
};

function replaceCharref(s) {
  if (s[0] === "#") {
    const hex = s[1] === "x" || s[1] === "X";
    const num = parseInt(s.slice(hex ? 2 : 1).replace(/;$/, ""), hex ? 16 : 10);
    if (num in INVALID_CHARREFS) return INVALID_CHARREFS[num];
    if ((num >= 0xd800 && num <= 0xdfff) || num > 0x10ffff) return "�";
    return String.fromCodePoint(num);
  }
  if (s in HTML5_ENTITIES) return HTML5_ENTITIES[s];
  // Longest legacy prefix, e.g. "&ampx" -> "&x" (as html.unescape does).
  for (let x = s.length - 1; x > 1; x--) {
    if (s.slice(0, x) in HTML5_ENTITIES) return HTML5_ENTITIES[s.slice(0, x)] + s.slice(x);
  }
  return "&" + s;
}

function decodeEntities(s) {
  if (!s.includes("&")) return s;
  return s.replace(/&(#[0-9]+;?|#[xX][0-9a-fA-F]+;?|[^\t\n\f <&#;]{1,32};?)/g,
    (_, ref) => replaceCharref(ref));
}

// ── CSS handling ────────────────────────────────────────────────────────────
function cssClean(css) {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\\([0-9a-fA-F]{1,6})\s?/g, (_, h) => {
      const cp = parseInt(h, 16);
      return cp <= 0x10ffff ? String.fromCodePoint(cp) : "";
    })
    .replace(/\\(.)/g, "$1")
    .toLowerCase();
}

function parseDecls(css) {
  const out = {};
  for (const decl of cssClean(css).split(";")) {
    const i = decl.indexOf(":");
    if (i === -1) continue;
    out[decl.slice(0, i).trim()] = decl.slice(i + 1).replace("!important", "").trim();
  }
  return out;
}

function num(value) {
  const m = /^(-?\d*\.?\d+)\s*([a-z%]*)$/.exec((value || "").trim());
  return m ? [parseFloat(m[1]), m[2]] : null;
}

const NAMED_COLOURS = {
  white: [255, 255, 255], snow: [255, 250, 250], ivory: [255, 255, 240],
  ghostwhite: [248, 248, 255], whitesmoke: [245, 245, 245],
  floralwhite: [255, 250, 240], mintcream: [245, 255, 250],
  azure: [240, 255, 255], aliceblue: [240, 248, 255],
  seashell: [255, 245, 238], honeydew: [240, 255, 240],
  linen: [250, 240, 230], oldlace: [253, 245, 230],
  black: [0, 0, 0],
};

function rgba(value) {
  const v = value.trim().replace(/ /g, "");
  if (v === "transparent") return [0, 0, 0, 0];
  if (v in NAMED_COLOURS) return [...NAMED_COLOURS[v], 1];
  let m = /^#([0-9a-f]{3,8})$/.exec(v);
  if (m) {
    let h = m[1];
    if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join("");
    if (h.length === 6 || h.length === 8) {
      const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
      return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), a];
    }
  }
  m = /^(rgba?|hsla?)\(([^)]*)\)$/.exec(v);
  if (m) {
    const parts = m[2].split(/[,/]/).filter(Boolean);
    let a = 1;
    if (parts.length >= 4) a = parts[3].endsWith("%") ? parseFloat(parts[3]) / 100 : parseFloat(parts[3]);
    let rgb;
    if (m[1].startsWith("rgb")) {
      rgb = parts.slice(0, 3).map((p) => (p.endsWith("%") ? parseFloat(p) * 2.55 : parseFloat(p)));
    } else {
      const light = parseFloat((parts[2] || "").replace("%", ""));
      rgb = [255 * light / 100, 255 * light / 100, 255 * light / 100];
    }
    if ([...rgb, a].some((x) => Number.isNaN(x))) return null;
    return [...rgb, a];
  }
  return null;
}

const isLight = (c) => c !== null && Math.min(c[0], c[1], c[2]) >= 230;

function declsHide(d) {
  if ((d.display || "").startsWith("none")) return true;
  if (["hidden", "collapse"].includes(d.visibility)) return true;
  if (d["mso-hide"] === "all") return true;
  const op = num(d.opacity);
  if (op && (op[0] < 0.1 || (op[1] === "%" && op[0] < 10))) return true;
  const fs = num(d["font-size"]);
  if (fs) {
    const limits = { px: 3, pt: 3, em: 0.2, rem: 0.2, "%": 20, "": 3 };
    if (fs[0] <= 0 || fs[0] < (limits[fs[1]] ?? 0)) return true;
  }
  for (const prop of ["height", "max-height", "width", "max-width"]) {
    const n = num(d[prop]);
    if (n && n[0] <= 0) return true;
  }
  const w = num(d.width), h = num(d.height);
  if (w && h && w[0] <= 1 && h[0] <= 1) return true; // "screen-reader only"
  for (const prop of ["left", "top", "right", "bottom", "text-indent", "margin-left", "margin-top"]) {
    const n = num(d[prop]);
    if (n && n[0] <= -500) return true;
  }
  if ((d.clip || "").replace(/ /g, "").startsWith("rect(0")) return true;
  if (/^inset\(\s*(50|100)%/.test(d["clip-path"] || "")) return true;
  if (/^scale\(\s*0*(\.0+)?\s*[,)]/.test(d.transform || "")) return true;
  const fg = "color" in d ? rgba(d.color) : null;
  if (fg !== null && fg[3] < 0.1) return true;
  const bgVal = d["background-color"] || d.background || "";
  const bg = bgVal ? rgba(bgVal.split(/\s+/)[0]) : null;
  if (fg !== null && bg !== null && [0, 1, 2].every((i) => Math.abs(fg[i] - bg[i]) < 16)) return true;
  return false;
}

function setsDarkBg(d) {
  const bgVal = d["background-color"] || d.background || "";
  if (!bgVal) return false;
  const bg = rgba(bgVal.split(/\s+/)[0]);
  return bg === null || !isLight(bg);
}

/** Simple selectors that <style> blocks hide (fail closed on complex ones). */
function hiddenSelectors(html) {
  const tags = new Set(), ids = new Set(), classes = new Set();
  const blocks = html.matchAll(/<style\b[^>]*>([\s\S]*?)(?:<\/style\s*>|$)/gi);
  for (const [, block] of blocks) {
    for (const [, selectors, body] of cssClean(block).matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      if (!declsHide(parseDecls(body))) continue;
      for (let sel of selectors.split(",")) {
        sel = sel.replace(/::?[a-z-]+(\([^)]*\))?/g, "").trim();
        if (!sel || sel.startsWith("@")) continue;
        const last = sel.split(/[\s>+~]+/).pop();
        const cls = [...last.matchAll(/\.([a-z0-9_-]+)/g)].map((m) => m[1]);
        const idents = [...last.matchAll(/#([a-z0-9_-]+)/g)].map((m) => m[1]);
        const tag = /^([a-z][a-z0-9]*)/.exec(last);
        if (cls.length || idents.length) {
          cls.forEach((c) => classes.add(c));
          idents.forEach((i) => ids.add(i));
        } else if (tag && !["html", "body"].includes(tag[1])) {
          tags.add(tag[1]);
        }
      }
    }
  }
  return { tags, ids, classes };
}

// "<!-->" and "<!--->" are complete comments; others end at "-->" or "--!>".
const COMMENT_RE = /<!--(?:>|->|[\s\S]*?(?:-->|--!>|$))/g;

// ── Tokenizer ───────────────────────────────────────────────────────────────
// Yields {type:"start"|"end"|"text", tag, attrs, text}.
function* tokenize(html) {
  let i = 0;
  const n = html.length;
  const skipTo = (needle, from) => {
    const end = html.indexOf(needle, from);
    return end === -1 ? n : end + needle.length;
  };
  while (i < n) {
    const lt = html.indexOf("<", i);
    if (lt === -1) { yield { type: "text", text: decodeEntities(html.slice(i)) }; return; }
    if (lt > i) yield { type: "text", text: decodeEntities(html.slice(i, lt)) };
    i = lt;

    if (html.startsWith("<!--", i)) {
      if (html.startsWith("<!-->", i)) { i += 5; continue; }
      if (html.startsWith("<!--->", i)) { i += 6; continue; }
      const a = html.indexOf("-->", i + 4);
      const b = html.indexOf("--!>", i + 4);
      if (a === -1 && b === -1) { i = n; continue; }
      i = (b !== -1 && (a === -1 || b < a)) ? b + 4 : a + 3;
      continue;
    }
    if (html[i + 1] === "!" || html[i + 1] === "?") { i = skipTo(">", i); continue; }

    const isEnd = html[i + 1] === "/";
    const nameStart = i + (isEnd ? 2 : 1);
    if (!/[a-zA-Z]/.test(html[nameStart] || "")) {
      if (isEnd) { i = skipTo(">", i); continue; } // "</ x>" is a bogus comment
      yield { type: "text", text: "<" };
      i += 1;
      continue;
    }
    let j = nameStart;
    while (j < n && !/[\s/>]/.test(html[j])) j++;
    const tag = html.slice(nameStart, j).toLowerCase();

    // Attributes (quoted values may contain ">"); first occurrence wins.
    const attrs = {};
    while (j < n && html[j] !== ">") {
      if (/[\s/]/.test(html[j])) { j++; continue; }
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
    // Browsers ignore "/>" on non-void elements, so it is always a start tag.
    yield { type: "start", tag, attrs };

    if (RAW_TEXT.has(tag)) {
      const m = new RegExp(`</${tag}\\s*>`, "i").exec(html.slice(i));
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
  const stack = []; // {tag, suppress, href, darkBg}
  const suppressed = () => stack.some((e) => e.suppress);
  const darkBg = () => stack.some((e) => e.darkBg);
  // Hidden elements closed implicitly by an outer end tag are pushed back
  // (browsers re-open formatting elements; over-hiding is the safe failure).
  const close = (tag) => {
    for (let i = stack.length - 1; i >= 0; i--) {
      if (stack[i].tag === tag) {
        const removed = stack.splice(i);
        stack.push(...removed.slice(1).filter((e) => e.suppress));
        return removed[0];
      }
    }
    return null;
  };

  try {
    const sel = hiddenSelectors(html);
    html = html.replace(COMMENT_RE, ""); // browser comment rules, as in sanitize.py
    const isHidden = (tag, a) => {
      if ("hidden" in a || (a["aria-hidden"] || "").trim().toLowerCase() === "true") return true;
      if (tag === "input" && (a.type || "").toLowerCase() === "hidden") return true;
      if (sel.tags.has(tag) || sel.ids.has((a.id || "").toLowerCase())) return true;
      if ((a.class || "").toLowerCase().split(/\s+/).some((c) => sel.classes.has(c))) return true;
      const d = parseDecls(a.style || "");
      if (a.color && !("color" in d)) d.color = a.color.toLowerCase();
      if (a.bgcolor && !("background-color" in d)) d["background-color"] = a.bgcolor.toLowerCase();
      if (declsHide(d)) return true;
      if ("color" in d && isLight(rgba(d.color)) && !darkBg() && !setsDarkBg(d)) return true;
      return false;
    };

    for (const t of tokenize(html)) {
      if (t.type === "text") {
        if (!suppressed()) out.push(t.text);
      } else if (t.type === "start") {
        const { tag, attrs } = t;
        if (SELF_CLOSING_SIBLINGS.has(tag) && stack.length && stack[stack.length - 1].tag === tag) {
          close(tag);
        }
        if (BLOCK.has(tag) && !suppressed()) out.push("\n");
        if (VOID.has(tag)) continue;
        const suppress = DROP_CONTENT.has(tag) || isHidden(tag, attrs);
        let href = null;
        if (tag === "a") {
          const raw = stripInvisible(attrs.href || "").trim();
          if (SAFE_SCHEMES.some((s) => raw.toLowerCase().startsWith(s))) href = raw;
        }
        const d = parseDecls(attrs.style || "");
        if (attrs.bgcolor && !("background-color" in d)) d["background-color"] = attrs.bgcolor.toLowerCase();
        stack.push({ tag, suppress, href, darkBg: setsDarkBg(d) });
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

/** Remove anything resembling a boundary marker, until none remain. */
export function removeMarkers(text) {
  for (;;) {
    const cleaned = text.replace(MARK_RE, "");
    if (cleaned === text) return cleaned;
    text = cleaned;
  }
}

function wrap(text) {
  const clean = removeMarkers(text);
  return clean ? `${BEGIN_MARK}\n${clean}\n${END_MARK}` : "";
}

function sanitizeItemBody(body) {
  if (typeof body.content !== "string") return body;
  const text = String(body.contentType || "").toLowerCase() === "html"
    ? htmlToSafeText(body.content)
    : tidy(stripInvisible(body.content));
  return { ...body, contentType: "text", content: wrap(text) };
}

/**
 * Return a sanitised copy of a Graph JSON response: every itemBody becomes
 * wrapped visible text; bodyPreview is wrapped (it may contain hidden text);
 * every other string loses invisible code points.
 */
export function sanitizeResponse(data) {
  if (Array.isArray(data)) return data.map(sanitizeResponse);
  if (data && typeof data === "object") {
    if ("contentType" in data && "content" in data) return sanitizeItemBody(data);
    return Object.fromEntries(Object.entries(data).map(([k, v]) => [
      k,
      k === "bodyPreview" && typeof v === "string" ? wrap(tidy(stripInvisible(v))) : sanitizeResponse(v),
    ]));
  }
  if (typeof data === "string") return stripInvisible(data);
  return data;
}
