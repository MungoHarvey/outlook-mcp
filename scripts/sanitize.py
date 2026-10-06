"""
sanitize.py — Neutralise untrusted message content before it reaches the model.

Email, event and contact text is attacker-controlled: anyone can send the user
a message. HTML lets a sender hide instructions from the human reader (hidden
CSS, zero-size or white text, comments, invisible Unicode) while the model
still reads them. This module runs INSIDE the proxy, so the model only ever
sees the sanitised text — never the raw HTML.

Design rule: when in doubt, hide. Dropping some legitimate text is acceptable;
showing the model text a human could not see is not.

Stdlib only (html.parser — a real tokenizer, not regex). Mirrored by
mcp-server/src/sanitize.js; both are checked against the shared cases in
test/fixtures/sanitize-cases.json.

Public API:
  strip_invisible(text)       -> text without zero-width / bidi / tag chars
  html_to_safe_text(html)     -> visible text only, links reduced to safe URLs
  sanitize_response(data)     -> sanitised copy of a Graph JSON response
"""

import re
from html.parser import HTMLParser

# Boundary markers wrapped around every message body. The model is told (in
# outlook-base) that text between them is data, never instructions. Anything
# resembling a marker inside the content is removed first (case- and
# whitespace-insensitive, repeated until stable) so a sender cannot "close"
# the block early and smuggle text outside it.
BEGIN_MARK = "[BEGIN UNTRUSTED CONTENT]"
END_MARK = "[END UNTRUSTED CONTENT]"
_MARK_RE = re.compile(r"\[\s*(?:begin|end)\s+untrusted\s+content\s*\]", re.I)

# ── Invisible / formatting code points ─────────────────────────────────────────
# Zero-width and joiner chars, bidi overrides/isolates, soft hyphen, fillers,
# BOM, variation selectors and the Unicode "tag" block (U+E0000–E007F) used
# for ASCII smuggling.
_INVISIBLE_RE = re.compile(
    "["
    "\u00ad\u034f\u061c\u115f\u1160\u17b4\u17b5\u180b-\u180f"
    "\u200b-\u200f\u202a-\u202e\u2060-\u2064\u2066-\u206f"
    "\u3164\ufe00-\ufe0f\ufeff\uffa0"
    "\U000e0000-\U000e007f"
    "]"
)


def strip_invisible(text):
    """Remove invisible/formatting code points that can hide instructions."""
    return _INVISIBLE_RE.sub("", text)


# ── Element classes ────────────────────────────────────────────────────────────
# Content of these is never visible text.
_DROP_CONTENT = {
    "script", "style", "head", "title", "noscript", "template", "iframe",
    "object", "embed", "svg", "math", "canvas", "select", "textarea", "button",
    "noembed", "noframes", "xmp",
}
# Browsers read everything up to the matching end tag as raw text — markup
# inside is not parsed. Handled here explicitly so behaviour does not depend
# on the Python patch level (html.parser only did script/style before 2025).
_RAW_TEXT = {"script", "style", "iframe", "noembed", "noframes", "noscript",
             "title", "textarea", "xmp"}
_VOID = {
    "area", "base", "br", "col", "embed", "hr", "img", "input", "link",
    "meta", "param", "source", "track", "wbr",
}
_BLOCK = {
    "address", "article", "aside", "blockquote", "div", "dl", "dt", "dd",
    "fieldset", "figcaption", "figure", "footer", "form", "h1", "h2", "h3",
    "h4", "h5", "h6", "header", "hr", "li", "main", "nav", "ol", "p", "pre",
    "section", "table", "tr", "ul", "br", "center",
}
# Opening one of these implicitly closes an open element of the same name
# (unclosed <p>/<li> are common in mail HTML).
_SELF_CLOSING_SIBLINGS = {"p", "li", "td", "th", "tr", "option", "dt", "dd"}

_SAFE_SCHEMES = ("http://", "https://", "mailto:")


# ── CSS handling ───────────────────────────────────────────────────────────────

def _css_clean(css):
    """Lower-case CSS with comments removed and escapes decoded."""
    css = re.sub(r"/\*.*?\*/", "", css, flags=re.S)
    css = re.sub(r"\\([0-9a-fA-F]{1,6})\s?",
                 lambda m: chr(int(m.group(1), 16)) if int(m.group(1), 16) <= 0x10FFFF else "",
                 css)
    css = re.sub(r"\\(.)", r"\1", css)
    return css.lower()


def _parse_decls(css):
    """'a:b; c:d' -> {'a': 'b', 'c': 'd'} (later declarations win, as in CSS)."""
    out = {}
    for decl in _css_clean(css).split(";"):
        if ":" in decl:
            prop, val = decl.split(":", 1)
            out[prop.strip()] = val.replace("!important", "").strip()
    return out


_NUM_RE = re.compile(r"^(-?\d*\.?\d+)\s*([a-z%]*)$")


def _num(value):
    """'2px' -> (2.0, 'px'); None if not a single number."""
    m = _NUM_RE.match(value.strip()) if value else None
    return (float(m.group(1)), m.group(2)) if m else None


_NAMED_COLOURS = {
    "white": (255, 255, 255), "snow": (255, 250, 250), "ivory": (255, 255, 240),
    "ghostwhite": (248, 248, 255), "whitesmoke": (245, 245, 245),
    "floralwhite": (255, 250, 240), "mintcream": (245, 255, 250),
    "azure": (240, 255, 255), "aliceblue": (240, 248, 255),
    "seashell": (255, 245, 238), "honeydew": (240, 255, 240),
    "linen": (250, 240, 230), "oldlace": (253, 245, 230),
    "black": (0, 0, 0),
}


def _rgba(value):
    """Parse a CSS colour to (r, g, b, a); None if unknown."""
    v = value.strip().replace(" ", "")
    if v == "transparent":
        return (0, 0, 0, 0.0)
    if v in _NAMED_COLOURS:
        return (*_NAMED_COLOURS[v], 1.0)
    m = re.match(r"^#([0-9a-f]{3,8})$", v)
    if m:
        h = m.group(1)
        if len(h) in (3, 4):
            h = "".join(c * 2 for c in h)
        if len(h) in (6, 8):
            a = int(h[6:8], 16) / 255 if len(h) == 8 else 1.0
            return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)
    m = re.match(r"^(rgba?|hsla?)\(([^)]*)\)$", v)
    if m:
        parts = [p for p in re.split(r"[,/]", m.group(2)) if p]
        try:
            a = 1.0
            if len(parts) >= 4:
                a = float(parts[3][:-1]) / 100 if parts[3].endswith("%") else float(parts[3])
            if m.group(1).startswith("rgb"):
                rgb = [float(p[:-1]) * 2.55 if p.endswith("%") else float(p) for p in parts[:3]]
            else:
                # hsl: only lightness matters for "near white"
                light = float(parts[2].rstrip("%"))
                rgb = [255.0 * light / 100] * 3
            return (*rgb, a)
        except (ValueError, IndexError):
            return None
    return None


def _is_light(rgba):
    """True for white / near-white colours (invisible on a default background)."""
    return rgba is not None and min(rgba[:3]) >= 230


def _decls_hide(d):
    """True if these CSS declarations hide the element's content."""
    if d.get("display", "").startswith("none"):
        return True
    if d.get("visibility", "") in ("hidden", "collapse"):
        return True
    if d.get("mso-hide", "") == "all":
        return True
    op = _num(d.get("opacity", ""))
    if op and op[0] < 0.1 or (op and op[1] == "%" and op[0] < 10):
        return True
    fs = _num(d.get("font-size", ""))
    if fs:
        size, unit = fs
        limits = {"px": 3, "pt": 3, "em": 0.2, "rem": 0.2, "%": 20, "": 3}
        if size <= 0 or size < limits.get(unit, 0):
            return True
    for prop in ("height", "max-height", "width", "max-width"):
        n = _num(d.get(prop, ""))
        if n and n[0] <= 0:
            return True
    w, h = _num(d.get("width", "")), _num(d.get("height", ""))
    if w and h and w[0] <= 1 and h[0] <= 1:          # "screen-reader only"
        return True
    for prop in ("left", "top", "right", "bottom", "text-indent",
                 "margin-left", "margin-top"):
        n = _num(d.get(prop, ""))
        if n and n[0] <= -500:
            return True
    if d.get("clip", "").replace(" ", "").startswith("rect(0"):
        return True
    if re.match(r"inset\(\s*(50|100)%", d.get("clip-path", "")):
        return True
    if re.match(r"scale\(\s*0*(\.0+)?\s*[,)]", d.get("transform", "")):
        return True
    fg = _rgba(d.get("color", "")) if "color" in d else None
    if fg is not None and fg[3] < 0.1:
        return True
    bg_val = d.get("background-color") or d.get("background", "")
    bg = _rgba(bg_val.split()[0]) if bg_val else None
    if fg is not None and bg is not None and \
            all(abs(a - b) < 16 for a, b in zip(fg[:3], bg[:3])):
        return True
    return False


_RULE_RE = re.compile(r"([^{}]+)\{([^{}]*)\}")


def _hidden_selectors(html):
    """Collect simple selectors that <style> blocks hide: ({tags}, {ids}, {classes}).

    For compound/complex selectors the last simple part is used, which may
    hide more than a browser would — deliberately failing closed.
    """
    tags, ids, classes = set(), set(), set()
    for block in re.findall(r"<style\b[^>]*>(.*?)(?:</style\s*>|$)", html, flags=re.S | re.I):
        for selectors, body in _RULE_RE.findall(_css_clean(block)):
            if not _decls_hide(_parse_decls(body)):
                continue
            for sel in selectors.split(","):
                # Pseudo-classes/elements are dropped, not skipped: ".h:hover"
                # then hides .h always — over-hiding is the safe direction.
                sel = re.sub(r"::?[a-z-]+(\([^)]*\))?", "", sel).strip()
                if not sel or sel.startswith("@"):
                    continue
                last = re.split(r"[\s>+~]+", sel)[-1]
                cls = re.findall(r"\.([a-z0-9_-]+)", last)
                idents = re.findall(r"#([a-z0-9_-]+)", last)
                tag = re.match(r"^([a-z][a-z0-9]*)", last)
                if cls or idents:
                    classes.update(cls)
                    ids.update(idents)
                elif tag and tag.group(1) not in ("html", "body"):
                    tags.add(tag.group(1))
    return tags, ids, classes


class _SafeTextParser(HTMLParser):
    """Collect visible text; drop hidden subtrees, comments and unsafe links."""

    def __init__(self, hidden_selectors):
        super().__init__(convert_charrefs=True)
        self.out = []
        # Stack entries: [tag, suppresses_content, href_or_None, has_dark_bg]
        self.stack = []
        self.hidden_tags, self.hidden_ids, self.hidden_classes = hidden_selectors

    # Content is suppressed if any open element suppresses it.
    def _suppressed(self):
        return any(e[1] for e in self.stack)

    def _dark_bg(self):
        return any(e[3] for e in self.stack)

    def _is_hidden(self, tag, a):
        if "hidden" in a or a.get("aria-hidden", "").strip().lower() == "true":
            return True
        if tag == "input" and a.get("type", "").lower() == "hidden":
            return True
        if tag in self.hidden_tags or a.get("id", "").lower() in self.hidden_ids:
            return True
        if any(c in self.hidden_classes for c in a.get("class", "").lower().split()):
            return True
        d = _parse_decls(a.get("style", ""))
        if a.get("color"):
            d.setdefault("color", a["color"].lower())
        if a.get("bgcolor"):
            d.setdefault("background-color", a["bgcolor"].lower())
        if _decls_hide(d):
            return True
        # Near-white text with no dark background here or on any ancestor is
        # invisible on the default white reading pane.
        if "color" in d and _is_light(_rgba(d["color"])) and \
                not self._dark_bg() and not self._sets_dark_bg(d):
            return True
        return False

    @staticmethod
    def _sets_dark_bg(d):
        bg_val = d.get("background-color") or d.get("background", "")
        if not bg_val:
            return False
        bg = _rgba(bg_val.split()[0])
        # Unknown backgrounds (images, gradients) count as dark: fail open
        # only for *legibility*, never by revealing hidden text — a hidden
        # element is still caught by _decls_hide above.
        return bg is None or not _is_light(bg)

    def handle_starttag(self, tag, attrs):
        tag = tag.lower()
        # First occurrence of a duplicated attribute wins, as in browsers.
        a = {}
        for k, v in attrs:
            a.setdefault(k.lower(), v or "")
        if tag in _SELF_CLOSING_SIBLINGS and self.stack and self.stack[-1][0] == tag:
            self._close(tag)
        if tag in _BLOCK and not self._suppressed():
            self.out.append("\n")
        if tag in _VOID:
            return
        suppress = tag in _DROP_CONTENT or self._is_hidden(tag, a)
        href = None
        if tag == "a":
            raw = strip_invisible(a.get("href", "")).strip()
            # Only keep links a human could see and safely follow.
            if raw.lower().startswith(_SAFE_SCHEMES):
                href = raw
        d = _parse_decls(a.get("style", ""))
        if a.get("bgcolor"):
            d.setdefault("background-color", a["bgcolor"].lower())
        self.stack.append([tag, suppress, href, self._sets_dark_bg(d)])
        if tag in _RAW_TEXT:
            self.set_cdata_mode(tag)

    def handle_startendtag(self, tag, attrs):
        # Browsers ignore "/>" on non-void elements: <span hidden/> opens a span.
        self.handle_starttag(tag, attrs)

    def _close(self, tag):
        """Pop back to the matching open element; ignore stray end tags.

        Hidden elements closed *implicitly* (by an outer end tag) are pushed
        back: browsers re-open formatting elements, and hiding too much is
        the safe failure mode.
        """
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i][0] == tag:
                matched, above = self.stack[i], self.stack[i + 1:]
                del self.stack[i:]
                self.stack.extend(e for e in above if e[1])
                return matched
        return None

    def handle_endtag(self, tag):
        tag = tag.lower()
        was_suppressed = self._suppressed()
        closed = self._close(tag)
        if closed is None or was_suppressed and self._suppressed():
            return
        _, suppress, href, _ = closed
        if suppress:
            return
        if href:
            self.out.append(f" <{href}>")
        if tag in _BLOCK:
            self.out.append("\n")

    def handle_data(self, data):
        if not self._suppressed():
            self.out.append(data)

    # Comments, processing instructions and declarations never render.
    def handle_comment(self, data):
        pass

    def handle_pi(self, data):
        pass

    def handle_decl(self, decl):
        pass

    def unknown_decl(self, data):
        pass


def _tidy(text):
    text = text.replace("\r\n", "\n").replace("\r", "\n").replace("\u00a0", " ")
    text = re.sub(r"[ \t\f\v]+", " ", text)
    text = re.sub(r" *\n *", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


# HTML comments with browser semantics: "<!-->" and "<!--->" are complete
# (empty) comments; others end at "-->" or "--!>" (or run to the end).
# Removed before tokenising so behaviour never depends on the Python patch
# level's html.parser comment handling. Mirrored in sanitize.js.
_COMMENT_RE = re.compile(r"<!--(?:>|->|.*?(?:-->|--!>|$))", re.S)


def html_to_safe_text(html):
    """Convert untrusted HTML to the text a human reader would actually see."""
    try:
        selectors = _hidden_selectors(html)
        html = _COMMENT_RE.sub("", html)
        p = _SafeTextParser(selectors)
        p.feed(html)
        p.close()
    except Exception:
        # html.parser is tolerant; on a pathological input fail closed.
        return ""
    return _tidy(strip_invisible("".join(p.out)))


def remove_markers(text):
    """Remove anything resembling a boundary marker, until none remain."""
    while True:
        cleaned = _MARK_RE.sub("", text)
        if cleaned == text:
            return cleaned
        text = cleaned


def wrap_untrusted(text):
    """Wrap text in boundary markers (after removing spoofed markers)."""
    text = remove_markers(text)
    return f"{BEGIN_MARK}\n{text}\n{END_MARK}" if text else ""


def _sanitize_item_body(body):
    """Sanitise a Graph itemBody ({contentType, content})."""
    content = body.get("content")
    if not isinstance(content, str):
        return body
    if str(body.get("contentType", "")).lower() == "html":
        text = html_to_safe_text(content)
    else:
        text = _tidy(strip_invisible(content))
    out = dict(body)
    out["contentType"] = "text"
    out["content"] = wrap_untrusted(text)
    return out


def sanitize_response(data):
    """Return a sanitised copy of a Graph JSON response.

    - every itemBody (body, uniqueBody, …) → visible text, wrapped in markers
    - bodyPreview → wrapped in markers (Exchange builds it from the raw body,
      so it may include hidden text this module cannot see)
    - every other string → invisible code points stripped
    """
    if isinstance(data, dict):
        if "contentType" in data and "content" in data:
            return _sanitize_item_body(data)
        out = {}
        for k, v in data.items():
            if k == "bodyPreview" and isinstance(v, str):
                out[k] = wrap_untrusted(_tidy(strip_invisible(v)))
            else:
                out[k] = sanitize_response(v)
        return out
    if isinstance(data, list):
        return [sanitize_response(v) for v in data]
    if isinstance(data, str):
        return strip_invisible(data)
    return data
