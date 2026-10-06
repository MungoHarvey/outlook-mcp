"""
sanitize.py — Neutralise untrusted message content before it reaches the model.

Email, event and contact text is attacker-controlled: anyone can send the user
a message. HTML lets a sender hide instructions from the human reader (hidden
CSS, zero-size text, comments, invisible Unicode) while the model still reads
them. This module runs INSIDE the proxy, so the model only ever sees the
sanitised text — never the raw HTML.

Stdlib only (html.parser — a real tokenizer, not regex). Mirrored by
mcp-server/src/sanitize.js; both are checked against the shared cases in
test/fixtures/sanitize-cases.json.

Public API:
  strip_invisible(text)       -> text without zero-width / bidi / tag chars
  html_to_safe_text(html)     -> visible text only, links reduced to safe URLs
  sanitize_response(data)     -> walks a Graph JSON response in place-safe copy
"""

import re
from html.parser import HTMLParser

# Boundary markers wrapped around every message body. The model is told (in
# outlook-base) that text between them is data, never instructions. Any copy
# of the markers inside the content is removed first so a sender cannot
# "close" the block early and smuggle text outside it.
BEGIN_MARK = "[BEGIN UNTRUSTED CONTENT]"
END_MARK = "[END UNTRUSTED CONTENT]"

# ── Invisible / formatting code points ─────────────────────────────────────────
# Zero-width and joiner chars, bidi overrides/isolates, soft hyphen, fillers,
# BOM, and the Unicode "tag" block (U+E0000–E007F) used for ASCII smuggling.
_INVISIBLE_RE = re.compile(
    "["
    "­͏؜ᅟᅠ឴឵᠋-᠏"
    "​-‏‪-‮⁠-⁤⁦-⁯"
    "ㅤ︀-️﻿ﾠ"
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
}
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

# ── Hidden-style detection ─────────────────────────────────────────────────────
_HIDDEN_STYLE_RES = [
    re.compile(r"display\s*:\s*none"),
    re.compile(r"visibility\s*:\s*(hidden|collapse)"),
    re.compile(r"(^|[;\s])opacity\s*:\s*0*(\.0+)?\s*(;|$|!)"),
    re.compile(r"font-size\s*:\s*0*(\.\d+)?(px|pt|em|rem|%)?\s*(;|$|!)"),
    re.compile(r"font-size\s*:\s*(0?\.\d+|1)px"),
    re.compile(r"(^|[;\s])(max-)?(height|width)\s*:\s*0+(px|pt|em|%)?\s*(;|$|!)"),
    re.compile(r"(left|top|right|bottom|text-indent|margin-left|margin-top)"
               r"\s*:\s*-\d{3,}"),
    re.compile(r"color\s*:\s*transparent"),
    re.compile(r"clip\s*:\s*rect\(\s*0"),
    re.compile(r"clip-path\s*:\s*inset\(\s*(50|100)%"),
    re.compile(r"transform\s*:\s*scale\(\s*0(\.0+)?\s*[,)]"),
]
_COLOR_RE = re.compile(r"(?:^|[;\s])color\s*:\s*([^;!]+)")
_BG_RE = re.compile(r"background(?:-color)?\s*:\s*([^;!]+)")


def _norm_colour(value):
    v = value.strip().lower().replace(" ", "")
    aliases = {
        "#fff": "#ffffff", "white": "#ffffff", "rgb(255,255,255)": "#ffffff",
        "#000": "#000000", "black": "#000000", "rgb(0,0,0)": "#000000",
    }
    return aliases.get(v, v)


def _is_hidden(tag, attrs):
    """True if this element hides its content from a human reader."""
    a = {k.lower(): (v or "") for k, v in attrs}
    if "hidden" in a:
        return True
    if a.get("aria-hidden", "").strip().lower() == "true":
        return True
    if tag == "input" and a.get("type", "").lower() == "hidden":
        return True
    style = a.get("style", "").lower()
    if style:
        if any(r.search(style) for r in _HIDDEN_STYLE_RES):
            return True
        # Same foreground and background colour on one element = invisible.
        fg, bg = _COLOR_RE.search(style), _BG_RE.search(style)
        if fg and bg and _norm_colour(fg.group(1)) == _norm_colour(bg.group(1)):
            return True
    # Legacy <font color=...> matching an explicit bgcolor on the same element.
    if a.get("color") and a.get("bgcolor") and \
            _norm_colour(a["color"]) == _norm_colour(a["bgcolor"]):
        return True
    return False


class _SafeTextParser(HTMLParser):
    """Collect visible text; drop hidden subtrees, comments and unsafe links."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.out = []
        # Stack of (tag, suppresses_content, href_or_None)
        self.stack = []

    # Content is suppressed if any open element suppresses it.
    def _suppressed(self):
        return any(s for _, s, _ in self.stack)

    def handle_starttag(self, tag, attrs):
        tag = tag.lower()
        if tag in _SELF_CLOSING_SIBLINGS and self.stack and self.stack[-1][0] == tag:
            self._close(tag)
        if tag in _BLOCK and not self._suppressed():
            self.out.append("\n")
        if tag in _VOID:
            return
        suppress = tag in _DROP_CONTENT or _is_hidden(tag, attrs)
        href = None
        if tag == "a":
            raw = dict((k.lower(), v or "") for k, v in attrs).get("href", "")
            raw = strip_invisible(raw).strip()
            # Only keep links a human could see and safely follow.
            if raw.lower().startswith(_SAFE_SCHEMES):
                href = raw
        self.stack.append((tag, suppress, href))

    def handle_startendtag(self, tag, attrs):
        tag = tag.lower()
        if tag in _BLOCK and not self._suppressed():
            self.out.append("\n")

    def _close(self, tag):
        # Pop back to the matching open element; ignore stray end tags.
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i][0] == tag:
                popped = self.stack[i:]
                del self.stack[i:]
                return popped[0]
        return None

    def handle_endtag(self, tag):
        tag = tag.lower()
        was_suppressed = self._suppressed()
        closed = self._close(tag)
        if closed is None or was_suppressed and self._suppressed():
            return
        _, suppress, href = closed
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
    text = text.replace("\r\n", "\n").replace("\r", "\n").replace(" ", " ")
    text = re.sub(r"[ \t\f\v]+", " ", text)
    text = re.sub(r" *\n *", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def html_to_safe_text(html):
    """Convert untrusted HTML to the text a human reader would actually see."""
    p = _SafeTextParser()
    try:
        p.feed(html)
        p.close()
    except Exception:
        # html.parser is tolerant; on a pathological input fail closed.
        return ""
    return _tidy(strip_invisible("".join(p.out)))


def _wrap(text):
    text = text.replace(BEGIN_MARK, "").replace(END_MARK, "")
    return f"{BEGIN_MARK}\n{text}\n{END_MARK}"


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
    out["content"] = _wrap(text) if text else ""
    return out


def sanitize_response(data):
    """Return a sanitised copy of a Graph JSON response.

    - every itemBody (body, uniqueBody, …) → visible text, wrapped in markers
    - every other string → invisible code points stripped
    """
    if isinstance(data, dict):
        if "contentType" in data and "content" in data:
            return _sanitize_item_body(data)
        return {k: sanitize_response(v) for k, v in data.items()}
    if isinstance(data, list):
        return [sanitize_response(v) for v in data]
    if isinstance(data, str):
        return strip_invisible(data)
    return data
