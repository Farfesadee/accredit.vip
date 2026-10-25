"""Designed HTML report for an event (admin "full report").

Each report is generated in the event's own colours: the flyer is analysed for
its dominant hues and overall lightness, so a dark flyer produces a dark report
and a cream flyer a cream one, with the event theme colour driving the accents.
The output is a single self contained HTML file (flyer embedded as base64) that
opens in any browser and prints to PDF from the toolbar.
"""

from __future__ import annotations

import base64
import io
import math
from datetime import datetime
from string import Template
from typing import Any, Iterable

# --------------------------------------------------------------------------- #
# colour helpers
# --------------------------------------------------------------------------- #


def _rgb(value: str) -> tuple[int, int, int]:
    value = (value or "").strip().lstrip("#")
    if len(value) == 3:
        value = "".join(ch * 2 for ch in value)
    if len(value) != 6:
        return (128, 128, 128)
    try:
        return tuple(int(value[i : i + 2], 16) for i in (0, 2, 4))  # type: ignore[return-value]
    except ValueError:
        return (128, 128, 128)


def _hex(rgb: Iterable[float]) -> str:
    r, g, b = (max(0, min(255, int(round(v)))) for v in rgb)
    return f"#{r:02X}{g:02X}{b:02X}"


def _mix(a: str, b: str, t: float) -> str:
    """t=0 -> a, t=1 -> b."""
    ar, ag, ab = _rgb(a)
    br, bg, bb = _rgb(b)
    return _hex((ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t))


def _line_lum(c: float) -> float:
    c = c / 255.0
    return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4


def _lum(value: str) -> float:
    r, g, b = _rgb(value)
    return 0.2126 * _line_lum(r) + 0.7152 * _line_lum(g) + 0.0722 * _line_lum(b)


def _contrast(a: str, b: str) -> float:
    la, lb = _lum(a), _lum(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


def _sat(value: str) -> float:
    r, g, b = (v / 255 for v in _rgb(value))
    mx, mn = max(r, g, b), min(r, g, b)
    return 0.0 if mx == 0 else (mx - mn) / mx


def _hue(value: str) -> float:
    r, g, b = (v / 255 for v in _rgb(value))
    mx, mn = max(r, g, b), min(r, g, b)
    if mx == mn:
        return 0.0
    d = mx - mn
    if mx == r:
        h = ((g - b) / d) % 6
    elif mx == g:
        h = (b - r) / d + 2
    else:
        h = (r - g) / d + 4
    return h * 60.0


def _hue_gap(a: str, b: str) -> float:
    d = abs(_hue(a) - _hue(b)) % 360
    return min(d, 360 - d)


def _push(value: str, target_lum: float, on_dark: bool) -> str:
    """Lighten (on dark) or darken (on light) a colour until it reaches a
    luminance target, keeping its hue."""
    out = value
    for _ in range(40):
        if (_lum(out) >= target_lum) if on_dark else (_lum(out) <= target_lum):
            return out
        out = _mix(out, "#FFFFFF" if on_dark else "#000000", 0.06)
    return out


# --------------------------------------------------------------------------- #
# flyer analysis
# --------------------------------------------------------------------------- #


def analyse_flyer(image_bytes: bytes | None) -> dict[str, Any]:
    """Return dominant colours and overall lightness of the event artwork."""
    info: dict[str, Any] = {
        "mean_lum": 0.25,
        "colours": [],
        "swatches": [],
    }
    if not image_bytes:
        return info
    try:
        from PIL import Image
    except Exception:  # pragma: no cover - PIL is installed in production
        return info
    try:
        im = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    except Exception:
        return info

    small = im.copy()
    small.thumbnail((260, 260))
    pixels = list(small.getdata())
    if not pixels:
        return info

    info["mean_lum"] = sum(_lum(_hex(p)) for p in pixels) / len(pixels)

    try:
        quant = small.quantize(colors=12, method=Image.MEDIANCUT)
        pal = quant.getpalette() or []
        entries = sorted(quant.getcolors() or [], reverse=True)
    except Exception:
        return info

    total = sum(c for c, _ in entries) or 1
    scored: list[tuple[float, str]] = []
    for count, idx in entries:
        base = idx * 3
        if base + 2 >= len(pal):
            continue
        colour = _hex(pal[base : base + 3])
        share = count / total
        sat = _sat(colour)
        lum = _lum(colour)
        if sat < 0.16 or lum < 0.012 or lum > 0.96:
            continue
        scored.append((share * (0.35 + sat), colour))

    scored.sort(reverse=True)
    colours: list[str] = []
    for _, colour in scored:
        if all(_hue_gap(colour, seen) > 18 or _contrast(colour, seen) < 1.12 for seen in colours):
            colours.append(colour)
        if len(colours) >= 3:
            break

    info["colours"] = colours
    info["swatches"] = [c for _, c in scored[:6]]
    return info


def build_palette(theme_color: str | None, art: dict[str, Any]) -> dict[str, str]:
    mean_lum = float(art.get("mean_lum") or 0.25)
    colours: list[str] = list(art.get("colours") or [])
    light = mean_lum > 0.56

    accent = (theme_color or "").strip() or (colours[0] if colours else ("#8A6A2F" if light else "#C9A227"))
    if len(accent.lstrip("#")) != 6:
        accent = "#C9A227"
    if _sat(accent) < 0.12:
        accent = colours[0] if colours else ("#8A6A2F" if light else "#C9A227")

    accent2 = next((c for c in colours if _hue_gap(c, accent) > 28), accent)
    accent3 = next((c for c in colours if _hue_gap(c, accent) > 28 and c != accent2), accent2)

    if light:
        bg = _mix("#FFFFFF", accent, 0.05)
        surface = _mix("#FFFFFF", accent, 0.015)
        surface2 = _mix("#FFFFFF", accent, 0.055)
        ink = "#17150F"
        muted = _mix(ink, bg, 0.42)
        line = _mix(bg, accent, 0.22)
        # accent is the text safe shade, fill keeps the colour livelier for bars
        fill = _push(accent, 0.30, on_dark=False)
        fill2 = _push(accent2, 0.30, on_dark=False)
        fill3 = _push(accent3, 0.30, on_dark=False)
        accent = _push(accent, 0.16, on_dark=False)
        accent2 = _push(accent2, 0.20, on_dark=False)
        accent3 = _push(accent3, 0.22, on_dark=False)
        on_accent = "#FFFFFF" if _contrast(fill, "#FFFFFF") >= 3.2 else "#151310"
        neutral = _mix("#FFFFFF", ink, 0.12)
        hero_shade = "rgba(10,8,6,0.55)"
    else:
        bg = _mix("#08090C", accent, 0.07)
        surface = _mix(bg, accent, 0.10)
        surface2 = _mix(bg, accent, 0.18)
        ink = _mix("#FFFFFF", accent, 0.07)
        muted = _mix(ink, bg, 0.45)
        line = _mix(bg, accent, 0.34)
        fill = _push(accent, 0.52, on_dark=True)
        fill2 = _push(accent2, 0.46, on_dark=True)
        fill3 = _push(accent3, 0.44, on_dark=True)
        accent = _push(accent, 0.42, on_dark=True)
        accent2 = _push(accent2, 0.38, on_dark=True)
        accent3 = _push(accent3, 0.36, on_dark=True)
        on_accent = "#12100C" if _contrast(fill, "#12100C") >= 3.6 else "#FFFFFF"
        neutral = _mix(bg, ink, 0.17)
        hero_shade = "rgba(0,0,0,0.62)"

    return {
        "mode": "light" if light else "dark",
        "bg": bg,
        "surface": surface,
        "surface2": surface2,
        "ink": ink,
        "muted": muted,
        "line": line,
        "accent": accent,
        "accent2": accent2,
        "accent3": accent3,
        "fill": fill,
        "fill2": fill2,
        "fill3": fill3,
        "neutral": neutral,
        "on_accent": on_accent,
        "hero_shade": hero_shade,
    }


def embed_image(image_bytes: bytes | None, max_width: int = 1100) -> str:
    """Downscaled JPEG data URI so the report keeps working offline."""
    if not image_bytes:
        return ""
    try:
        from PIL import Image
    except Exception:  # pragma: no cover
        return ""
    try:
        im = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        if im.width > max_width:
            im = im.resize((max_width, int(im.height * max_width / im.width)), Image.LANCZOS)
        buf = io.BytesIO()
        im.save(buf, format="JPEG", quality=82, optimize=True)
        return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode("ascii")
    except Exception:
        return ""


# --------------------------------------------------------------------------- #
# formatting helpers
# --------------------------------------------------------------------------- #


def _num(value: Any) -> str:
    try:
        return f"{int(value):,}"
    except (TypeError, ValueError):
        return "0"


def _plural(count: Any, word: str, suffix: str = "s") -> str:
    try:
        n = int(count)
    except (TypeError, ValueError):
        n = 0
    return f"{n:,} {word}{'' if n == 1 else suffix}"


def _money(value: Any, currency: str | None) -> str:
    symbol = {
        "NGN": "\u20a6",
        "USD": "$",
        "GBP": "\u00a3",
        "EUR": "\u20ac",
        "GHS": "GH\u20b5",
        "KES": "KSh ",
        "ZAR": "R ",
    }.get((currency or "NGN").upper(), "")
    try:
        amount = float(value or 0)
    except (TypeError, ValueError):
        amount = 0.0
    body = f"{amount:,.0f}" if abs(amount - round(amount)) < 0.01 else f"{amount:,.2f}"
    return f"{symbol}{body}" if symbol else f"{body} {currency or ''}".strip()


def _date_label(value: Any) -> str:
    if not value:
        return ""
    try:
        return value.strftime("%A, %-d %B %Y")
    except Exception:
        try:
            return value.strftime("%A, %d %B %Y").replace(" 0", " ")
        except Exception:
            return str(value)


def _time_label(value: Any, tz: str | None) -> str:
    if not value:
        return ""
    try:
        text = value.strftime("%-I:%M %p")
    except Exception:
        try:
            text = value.strftime("%I:%M %p").lstrip("0")
        except Exception:
            text = str(value)
    return f"{text} ({tz})" if tz else text


def _short(value: Any) -> str:
    if not value:
        return ""
    try:
        return value.strftime("%d %b %Y")
    except Exception:
        return str(value)


def _pct(part: float, whole: float) -> int:
    if not whole:
        return 0
    return int(round(100 * part / whole))


def _esc(value: Any) -> str:
    text = "" if value is None else str(value)
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


# --------------------------------------------------------------------------- #
# pie charts
# --------------------------------------------------------------------------- #


def _pie_svg(items: list[tuple[str, int, str]], total: int, pal: dict[str, str]) -> str:
    """Plain SVG pie chart (no scripts, prints cleanly)."""
    if total <= 0:
        return (
            '<svg class="pie" viewBox="0 0 100 100" role="img" aria-label="No data">'
            f'<circle cx="50" cy="50" r="46" fill="{pal["surface2"]}" stroke="{pal["line"]}" stroke-width="0.8"/>'
            "</svg>"
        )

    paths: list[str] = []
    angle = -0.25  # start the first slice at twelve o'clock
    for _, value, colour in items:
        if not value:
            continue
        frac = min(1.0, value / total)
        if frac >= 0.9995:
            paths.append(f'<circle cx="50" cy="50" r="46" fill="{colour}"/>')
            continue
        a0 = angle * 2 * math.pi
        angle += frac
        a1 = angle * 2 * math.pi
        x0, y0 = 50 + 46 * math.cos(a0), 50 + 46 * math.sin(a0)
        x1, y1 = 50 + 46 * math.cos(a1), 50 + 46 * math.sin(a1)
        large = 1 if frac > 0.5 else 0
        paths.append(
            f'<path d="M50 50 L{x0:.2f} {y0:.2f} A46 46 0 {large} 1 {x1:.2f} {y1:.2f} Z" '
            f'fill="{colour}" stroke="{pal["surface"]}" stroke-width="1"/>'
        )

    return (
        '<svg class="pie" viewBox="0 0 100 100" role="img" aria-label="Breakdown chart">'
        + "".join(paths)
        + "</svg>"
    )


def _pie_legend(items: list[tuple[str, int, str]], total: int) -> str:
    rows = "".join(
        '<div class="l">'
        f'<span class="sw" style="background:{colour}"></span>'
        f"<span class=\"lab\">{_esc(label)}</span>"
        f"<b>{_num(value)}</b><i>{_pct(value, total)}%</i>"
        "</div>"
        for label, value, colour in items
    )
    return f'<div class="legend">{rows}</div>'


def _pie_block(items: list[tuple[str, int, str]], total: int, pal: dict[str, str]) -> str:
    return (
        '<div class="piewrap">'
        + _pie_svg(items, total, pal)
        + _pie_legend(items, total)
        + "</div>"
    )


def _collapsible(label: str, body: str, open_by_default: bool) -> str:
    """Native <details> toggle so long lists stay folded until asked for."""
    return (
        f'<details class="rost"{" open" if open_by_default else ""}>'
        f'<summary><span class="caret"></span>{_esc(label)}</summary>'
        f'<div class="rost-body">{body}</div>'
        "</details>"
    )


# --------------------------------------------------------------------------- #
# stylesheet
# --------------------------------------------------------------------------- #

CSS = Template(
    """
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{
  background:$bg;color:$ink;
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  -webkit-font-smoothing:antialiased;
  padding:0 0 56px;
}
a{color:inherit}
.wrap{max-width:1180px;margin:0 auto;padding:0 22px}
.serif{font-family:Georgia,"Times New Roman",serif}

/* toolbar */
.bar{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:18px 22px;border-bottom:1px solid $line;flex-wrap:wrap}
.bar .brand{display:flex;align-items:center;gap:10px;font-size:11px;letter-spacing:.28em;text-transform:uppercase;color:$muted}
.bar .dot{width:9px;height:9px;border-radius:50%;background:$fill;display:inline-block}
.bar .acts{display:flex;gap:8px;flex-wrap:wrap}
.btn{display:inline-flex;align-items:center;gap:7px;padding:9px 14px;border-radius:8px;font-size:11.5px;font-weight:600;letter-spacing:.04em;text-decoration:none;border:1px solid $line;color:$ink;background:transparent;cursor:pointer}
.btn.primary{background:$fill;border-color:$fill;color:$on_accent}

/* hero */
.hero{margin-top:22px;border-radius:18px;overflow:hidden;border:1px solid $line;background:$surface}
.hero .art{display:flex;align-items:center;justify-content:center;padding:18px;background:radial-gradient(120% 90% at 50% 0%,$surface2 0%,$surface 72%)}
.hero .art img{display:block;width:auto;max-width:100%;max-height:min(58vh,470px);object-fit:contain;border-radius:10px;box-shadow:0 18px 46px rgba(0,0,0,.24)}
.hero .copy{padding:22px 26px 24px;border-top:1px solid $line}
.eyebrow{font-size:10px;letter-spacing:.34em;text-transform:uppercase;color:$accent;font-weight:700}
.hero h1{font-family:Georgia,"Times New Roman",serif;font-weight:400;font-size:clamp(25px,4.2vw,42px);line-height:1.1;margin:9px 0 10px;color:$ink}
.hero .meta{margin:0;font-size:13px;color:$muted;letter-spacing:.02em}
.hero .meta + .meta{margin-top:2px}
.chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:15px}
.chip{font-size:9.5px;letter-spacing:.16em;text-transform:uppercase;padding:5px 9px;border-radius:999px;border:1px solid $line;color:$ink;background:$surface2}
.hero .copy .eyebrow{display:block}
.hero.plain .copy{border-top:0}

/* kpis */
.kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-top:18px}
.kpi{background:$surface;border:1px solid $line;border-radius:14px;padding:16px 16px 15px;position:relative;overflow:hidden}
.kpi:before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:$fill}
.kpi .k{font-size:9.5px;letter-spacing:.2em;text-transform:uppercase;color:$muted;font-weight:700}
.kpi .v{font-family:Georgia,"Times New Roman",serif;font-size:clamp(22px,3vw,31px);line-height:1.15;margin-top:8px}
.kpi .s{font-size:11px;color:$muted;margin-top:5px}
.kpi.alt:before{background:$fill2}
.kpi.alt2:before{background:$fill3}

/* generic cards */
.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-top:14px}
.card{background:$surface;border:1px solid $line;border-radius:16px;padding:20px 22px}
.card.full{margin-top:14px}
.card h2{font-family:Georgia,"Times New Roman",serif;font-weight:400;font-size:20px;margin:0 0 4px}
.card .hint{font-size:11.5px;color:$muted;margin:0 0 16px}
.card .hint.only{margin-bottom:0}

/* bars */
/* pie charts */
.piewrap{display:flex;align-items:center;gap:24px;flex-wrap:wrap}
.pie{width:172px;height:172px;flex:0 0 auto;filter:drop-shadow(0 10px 26px rgba(0,0,0,.18))}
.legend{display:flex;flex-direction:column;gap:10px;font-size:12px;color:$muted;flex:1;min-width:180px}
.legend .l{display:flex;align-items:center;gap:9px}
.legend .sw{width:10px;height:10px;border-radius:3px;display:inline-block;flex:0 0 auto}
.legend .lab{color:$ink}
.legend b{color:$ink;font-variant-numeric:tabular-nums;margin-left:auto}
.legend i{font-style:normal;font-variant-numeric:tabular-nums;color:$muted;font-size:11px;min-width:38px;text-align:right}
.legend i.wide{min-width:82px}

/* category list */

/* table */
.tblwrap{overflow-x:auto;border:1px solid $line;border-radius:12px;margin-top:4px}
table.tbl{width:100%;border-collapse:collapse;font-size:12px;min-width:620px;table-layout:auto}
table.tbl th{text-align:left;font-size:9.5px;letter-spacing:.16em;text-transform:uppercase;color:$muted;font-weight:700;padding:11px 12px;background:$surface2;white-space:nowrap}
table.tbl td{padding:10px 12px;border-top:1px solid $line;vertical-align:top;overflow-wrap:anywhere}
table.tbl tr:nth-child(even) td{background:rgba(127,127,127,.035)}
table.tbl td.num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.pill{display:inline-block;font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;padding:3px 8px;border-radius:999px;border:1px solid $line;color:$muted}
.pill.ok{color:$accent;border-color:$fill}
.pill.no{color:$muted}
.mono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px}
.empty{font-size:12.5px;color:$muted;padding:16px 0}

/* collapsible lists */
details.rost{margin-top:6px}
details.rost > summary{list-style:none;cursor:pointer;display:inline-flex;align-items:center;gap:10px;padding:9px 15px;border-radius:9px;border:1px solid $line;background:$surface2;font-size:11.5px;font-weight:600;letter-spacing:.03em;color:$ink;user-select:none}
details.rost > summary::-webkit-details-marker{display:none}
details.rost > summary:hover{border-color:$fill;color:$ink}
details.rost > summary .caret{width:0;height:0;border-left:5px solid $accent;border-top:4px solid transparent;border-bottom:4px solid transparent;transition:transform .15s ease;display:inline-block}
details.rost[open] > summary .caret{transform:rotate(90deg)}
details.rost > .rost-body{margin-top:12px}

footer{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;margin-top:26px;padding-top:16px;border-top:1px solid $line;font-size:11px;color:$muted}
footer .brand{letter-spacing:.24em;text-transform:uppercase;font-size:9.5px}

@media (max-width:900px){
  .kpis{grid-template-columns:repeat(2,minmax(0,1fr))}
  .grid{grid-template-columns:1fr}
  .pie{width:156px;height:156px}
}
@media (max-width:700px){
  .hero .art{padding:12px}
  .hero .art img{max-height:min(64vh,520px)}
  .wrap{padding:0 14px}
  .hero .copy{padding:18px}
  .card{padding:16px}
  .piewrap{gap:16px}
  .pie{width:138px;height:138px}
  .legend{min-width:0;flex:1 1 150px}
  /* tables collapse into stacked rows so nothing is cut off on a phone */
  table.tbl.stack{min-width:0}
  table.tbl.stack thead{display:none}
  table.tbl.stack tbody tr{display:block;padding:12px 14px;border-top:1px solid $line}
  table.tbl.stack tbody tr:first-child{border-top:0}
  table.tbl.stack td,table.tbl.stack tr:nth-child(even) td{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;padding:3px 0;border:0;background:transparent;text-align:right}
  table.tbl.stack td:before{content:attr(data-l);flex:0 0 auto;font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:$muted;padding-top:2px;text-align:left}
  table.tbl.stack td.idx{display:none}
}
@media print{
  body{background:#fff;padding:0}
  .bar .acts{display:none}
  .hero{break-inside:avoid}
  .card,.kpi,.tblwrap{break-inside:avoid}
  details.rost > summary{display:none}
  details.rost > .rost-body{margin-top:0}
  details.rost:not([open]) > .rost-body{display:block}
  *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
}
"""
)


# --------------------------------------------------------------------------- #
# report
# --------------------------------------------------------------------------- #


def build_event_report_html(
    event: Any,
    guests: list[Any],
    checked_in_ids: set[int],
    purchases: list[Any],
    flyer_bytes: bytes | None = None,
    generated_at: datetime | None = None,
) -> str:
    art = analyse_flyer(flyer_bytes)
    pal = build_palette(getattr(event, "theme_color", None), art)
    hero_src = embed_image(flyer_bytes)
    currency = getattr(event, "currency", None) or "NGN"

    total = len(guests)
    accepted = [g for g in guests if (g.rsvp_status or "") == "accepted"]
    pending = [g for g in guests if (g.rsvp_status or "") == "pending"]
    declined = [g for g in guests if (g.rsvp_status or "") == "declined"]
    maybe = [g for g in guests if (g.rsvp_status or "") == "maybe"]
    invited = [g for g in guests if g.invite_sent]
    checked = [g for g in guests if g.id in checked_in_ids]

    heads = 0
    for g in accepted:
        party = (g.custom_data or {}).get("party_size") if isinstance(g.custom_data, dict) else None
        try:
            heads += int(party) if party else 1
        except (TypeError, ValueError):
            heads += 1
    extra_heads = max(0, heads - len(accepted))

    orders = len(purchases)
    tickets_sold = sum(int(p.quantity or 0) for p in purchases)
    revenue = sum(float(p.amount or 0) for p in purchases)
    avg_order = revenue / orders if orders else 0

    check_rate = _pct(len(checked), total)
    expected_rate = _pct(len(checked), len(accepted)) if accepted else 0

    cats: dict[str, dict[str, int]] = {}
    for g in guests:
        name = (g.category or "").strip() or "Uncategorized"
        row = cats.setdefault(name, {"total": 0, "checked": 0})
        row["total"] += 1
        if g.id in checked_in_ids:
            row["checked"] += 1
    cat_rows = sorted(cats.items(), key=lambda kv: (-kv[1]["total"], kv[0]))

    now = generated_at or datetime.now()
    event_date = _date_label(getattr(event, "event_date", None))
    event_time = _time_label(getattr(event, "event_time", None), getattr(event, "timezone", None) or "WAT")
    place = ", ".join(
        [p for p in (getattr(event, "venue", None), getattr(event, "city", None), getattr(event, "state", None)) if p]
    )

    status = (getattr(event, "status", None) or "draft").replace("_", " ")
    visibility = "Public" if getattr(event, "is_public", False) else "Private"
    cap = getattr(event, "guest_count_range", None) or "Unlimited"
    reg_open = "Registration open" if getattr(event, "registration_open", True) else "Registration closed"

    # ---- hero --------------------------------------------------------- #
    chips = "".join(
        f'<span class="chip">{_esc(item)}</span>'
        for item in (status.title(), visibility, reg_open, f"Cap {cap}")
    )
    if hero_src:
        hero = (
            '<section class="hero">'
            f'<div class="art"><img src="{hero_src}" alt="{_esc(getattr(event, "title", "Event"))} flyer" /></div>'
            '<div class="copy">'
            '<span class="eyebrow">Event report</span>'
            f"<h1>{_esc(getattr(event, 'title', 'Event'))}</h1>"
            f'<p class="meta">{_esc(event_date)} &middot; {_esc(event_time)}</p>'
            f'<p class="meta">{_esc(place)}</p>'
            f'<div class="chips">{chips}</div>'
            "</div></section>"
        )
    else:
        hero = (
            '<section class="hero plain"><div class="copy">'
            '<span class="eyebrow">Event report</span>'
            f"<h1>{_esc(getattr(event, 'title', 'Event'))}</h1>"
            f'<p class="meta">{_esc(event_date)} &middot; {_esc(event_time)}</p>'
            f'<p class="meta">{_esc(place)}</p>'
            f'<div class="chips">{chips}</div>'
            "</div></section>"
        )

    # ---- kpis --------------------------------------------------------- #
    kpis = [
        ("Guests on list", _num(total), f"Cap {cap}", ""),
        ("Accepted", _num(len(accepted)), f"{_pct(len(accepted), total)}% of the list", "alt"),
        ("Checked in", _num(len(checked)), f"{check_rate}% of the list", ""),
        (
            "Expected heads",
            _num(heads if accepted else 0),
            f"{_num(extra_heads)} plus one(s) included" if extra_heads else "No plus ones registered",
            "alt2",
        ),
        ("Invites sent", _num(len(invited)), f"{_pct(len(invited), total)}% of the list", "alt2"),
        ("Ticket orders", _num(orders), f"{_plural(tickets_sold, 'ticket')} issued", ""),
        ("Ticket revenue", _money(revenue, currency), f"Average {_money(avg_order, currency)}", "alt"),
        (
            "Turnout",
            f"{expected_rate}%",
            f"{_num(len(checked))} of {_num(len(accepted))} accepted guests arrived" if accepted else "No accepted guests yet",
            "",
        ),
    ]
    kpi_html = "".join(
        f'<div class="kpi {cls}"><div class="k">{_esc(k)}</div>'
        f'<div class="v">{_esc(v)}</div><div class="s">{_esc(s)}</div></div>'
        for k, v, s, cls in kpis
    )

    # ---- rsvp pie ----------------------------------------------------- #
    rsvp_slices = [
        ("Accepted", len(accepted), pal["fill"]),
        ("Pending", len(pending), pal["neutral"]),
        ("Declined", len(declined), pal["fill2"]),
        ("Maybe", len(maybe), pal["fill3"]),
    ]
    rsvp_html = _pie_block(rsvp_slices, total, pal)

    # ---- accreditation pie -------------------------------------------- #
    attendance_slices = [
        ("Checked in", len(checked), pal["fill"]),
        ("Not yet arrived", max(0, total - len(checked)), pal["neutral"]),
    ]
    donut = _pie_block(attendance_slices, total, pal)

    # ---- categories --------------------------------------------------- #
    if cat_rows:
        # keep the pie readable: top six categories, everything else as Other
        if len(cat_rows) > 7:
            head = cat_rows[:6]
            rest = cat_rows[6:]
            cat_rows = head + [
                (
                    "Other categories",
                    {
                        "total": sum(d["total"] for _, d in rest),
                        "checked": sum(d["checked"] for _, d in rest),
                    },
                )
            ]

        ramp = [
            pal["fill"],
            pal["fill2"],
            pal["fill3"],
            _mix(pal["fill"], pal["bg"], 0.42),
            _mix(pal["fill2"], pal["bg"], 0.42),
            _mix(pal["fill3"], pal["bg"], 0.42),
            pal["line"],
        ]
        cat_slices = [
            (name, d["total"], ramp[i % len(ramp)]) for i, (name, d) in enumerate(cat_rows)
        ]
        cat_html = (
            '<div class="piewrap">'
            + _pie_svg(cat_slices, total, pal)
            + '<div class="legend">'
            + "".join(
                '<div class="l">'
                f'<span class="sw" style="background:{colour}"></span>'
                f'<span class="lab">{_esc(name)}</span>'
                f"<b>{_num(d['total'])}</b>"
                f'<i class="wide">{_num(d["checked"])} checked</i>'
                "</div>"
                for (name, d), colour in zip(cat_rows, [s[2] for s in cat_slices])
            )
            + "</div></div>"
        )
    else:
        cat_html = '<p class="empty">No guest categories recorded for this event.</p>'

    # ---- ticket sales ------------------------------------------------- #
    if purchases:
        sale_rows = "".join(
            "<tr>"
            f'<td data-l="Buyer">{_esc(p.buyer_name or "")}</td>'
            f'<td data-l="Contact"><div>{_esc(p.buyer_email or "")}</div>'
            f'<div class="mono" style="color:{pal["muted"]}">{_esc(p.buyer_phone or "")}</div></td>'
            f'<td data-l="Package">{_esc(p.package_name or "Ticket")}</td>'
            f'<td class="num" data-l="Qty">{_num(p.quantity or 0)}</td>'
            f'<td class="num" data-l="Amount">{_esc(_money(p.amount or 0, currency))}</td>'
            f'<td class="mono" data-l="Reference">{_esc(p.reference or "")}</td>'
            f'<td class="num" data-l="Paid">{_esc(_short(p.paid_at or p.created_at))}</td>'
            "</tr>"
            for p in purchases
        )
        sales_html = (
            '<div class="tblwrap"><table class="tbl stack">'
            "<thead><tr><th>Buyer</th><th>Contact</th><th>Package</th>"
            "<th style='text-align:right'>Qty</th><th style='text-align:right'>Amount</th>"
            "<th>Reference</th><th style='text-align:right'>Paid</th></tr></thead>"
            f"<tbody>{sale_rows}</tbody></table></div>"
        )
        sales_html = _collapsible(
            f"Sales table ({_plural(orders, 'order')})", sales_html, orders <= 12
        )
    else:
        sales_html = '<p class="empty">No completed ticket sales recorded for this event.</p>'

    # ---- roster ------------------------------------------------------- #
    ordered_guests = sorted(guests, key=lambda g: (g.name or "").lower())
    guest_rows = []
    for i, g in enumerate(ordered_guests, 1):
        custom = g.custom_data if isinstance(g.custom_data, dict) else {}
        org = (custom.get("organization") or "").strip()
        contact = "".join(
            part
            for part in (
                f'<div>{_esc(g.email)}</div>' if g.email else "",
                f'<div class="mono" style="color:{pal["muted"]}">{_esc(g.phone)}</div>' if g.phone else "",
            )
        ) or f'<span style="color:{pal["muted"]}">&ndash;</span>'
        rsvp = (g.rsvp_status or "pending").lower()
        rsvp_cls = "ok" if rsvp == "accepted" else ("no" if rsvp == "declined" else "")
        arrived = g.id in checked_in_ids
        guest_rows.append(
            "<tr>"
            f'<td class="num idx" data-l="#" style="color:{pal["muted"]}">{i}</td>'
            f'<td data-l="Guest"><strong>{_esc(g.name)}{" &middot; +1" if custom.get("party_size") == 2 else ""}</strong>'
            + (f'<div style="color:{pal["muted"]}">{_esc(org)}</div>' if org else "")
            + "</td>"
            f'<td data-l="Contact">{contact}</td>'
            f'<td data-l="Category">{_esc(g.category or "-")}</td>'
            f'<td data-l="RSVP"><span class="pill {rsvp_cls}">{_esc(rsvp)}</span></td>'
            f'<td data-l="Invited">{"Yes" if g.invite_sent else "No"}</td>'
            f'<td data-l="Accreditation"><span class="pill {"ok" if arrived else "no"}">{"Checked in" if arrived else "Not yet"}</span></td>'
            "</tr>"
        )
    roster_html = (
        _collapsible(
            f"Guest list ({_plural(total, 'guest')})",
            '<div class="tblwrap"><table class="tbl stack">'
            "<thead><tr><th style='width:44px'>#</th><th>Guest</th><th>Contact</th>"
            "<th>Category</th><th>RSVP</th><th>Invited</th><th>Accreditation</th></tr></thead>"
            f"<tbody>{''.join(guest_rows)}</tbody></table></div>",
            total <= 12,
        )
        if guest_rows
        else '<p class="empty">No guests on this event.</p>'
    )

    css = CSS.safe_substitute(pal)
    theme_meta = '<meta name="theme-color" content="' + pal["bg"] + '" />'

    return (
        "<!DOCTYPE html><html lang=\"en\"><head>"
        '<meta charset="utf-8" />'
        '<meta name="viewport" content="width=device-width, initial-scale=1" />'
        f"{theme_meta}"
        f"<title>{_esc(getattr(event, 'title', 'Event'))} - Event Report</title>"
        f"<style>{css}</style></head><body>"
        '<div class="bar"><div class="brand"><span class="dot"></span>'
        "Accredit Interactive &middot; Event report</div>"
        '<div class="acts">'
        '<button class="btn" onclick="window.print()">Print / Save as PDF</button>'
        '<a class="btn primary" href="?download=1">Download this HTML</a>'
        "</div></div>"
        '<div class="wrap">'
        f"{hero}"
        f'<section class="kpis">{kpi_html}</section>'
        '<section class="grid">'
        '<div class="card"><h2>RSVP response</h2>'
        f'<p class="hint">How the guest list has answered</p>'
        f"{rsvp_html}</div>"
        '<div class="card"><h2>Accreditation</h2>'
        f'<p class="hint">{check_rate}% scanned in &middot; {_num(len(checked))} of {_num(total)} guests</p>'
        f"{donut}</div>"
        "</section>"
        f'<section class="card full"><h2>Accreditation by category</h2>'
        f'<p class="hint">Checked in against the total issued in each category</p>{cat_html}</section>'
        f'<section class="card full"><h2>Ticket sales</h2>'
        f'<p class="hint">{_plural(orders, "order")} &middot; {_plural(tickets_sold, "ticket")} &middot; '
        f"{_esc(_money(revenue, currency))} collected</p>{sales_html}</section>"
        f'<section class="card full"><h2>Guest roster</h2>'
        f'<p class="hint">Every guest on the list with contact, category, RSVP and accreditation status</p>'
        f"{roster_html}</section>"
        '<footer><div>Generated ' + _esc(now.strftime("%d %B %Y, %H:%M")) + "</div>"
        '<div class="brand">Accredit Interactive &middot; Premium Event Infrastructure</div></footer>'
        "</div>"
        "<script>"
        "document.querySelectorAll('details.rost > summary').forEach(function(s){"
        "s.addEventListener('click',function(){var d=s.parentElement;"
        "setTimeout(function(){if(d.open){d.scrollIntoView({block:'nearest'});}},60);});});"
        "window.addEventListener('beforeprint',function(){"
        "document.querySelectorAll('details.rost').forEach(function(d){d.open=true;});});"
        "</script>"
        "</body></html>"
    )
