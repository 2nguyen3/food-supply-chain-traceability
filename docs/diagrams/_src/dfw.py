"""Mini framework: build draw.io files with explicit geometry, lint overlaps, render preview PNGs."""
import math
import re
from pathlib import Path
from xml.sax.saxutils import escape

FS = 15
INK = "fontColor=#000000;"
FONT = "fontFamily=Helvetica;fontSize=15;" + INK
BOX = "rounded=1;whiteSpace=wrap;html=1;arcSize=8;strokeWidth=1.5;" + FONT


def S(fill, stroke):
    return BOX + f"fillColor={fill};strokeColor={stroke};"


BLUE = S("#ffffff", "#000000")
GREEN = S("#ffffff", "#000000")
ORANGE = S("#ffffff", "#000000")
PURPLE = S("#ffffff", "#000000")
GREY = S("#ffffff", "#000000")
RED = S("#ffffff", "#000000")
YELLOW = S("#ffffff", "#000000")
WHITE = S("#ffffff", "#000000")
NOTE = ("shape=note;size=12;whiteSpace=wrap;html=1;align=left;verticalAlign=top;spacingLeft=8;spacingTop=4;"
        "fontFamily=Helvetica;fontSize=14;" + INK + "fillColor=#ffffff;strokeColor=#000000;")
TEXT = "text;html=1;whiteSpace=wrap;align=center;verticalAlign=middle;fontFamily=Helvetica;fontSize=14;" + INK
TEXTL = TEXT.replace("align=center", "align=left")
TITLE = "text;html=1;align=left;verticalAlign=middle;fontStyle=1;fontSize=22;fontFamily=Helvetica;" + INK
ZONE = ("rounded=1;whiteSpace=wrap;html=1;arcSize=3;dashed=1;dashPattern=6 4;verticalAlign=top;align=left;"
        "spacingLeft=10;spacingTop=4;fontStyle=1;fontFamily=Helvetica;fontSize=15;" + INK +
        "fillColor=#ffffff;strokeColor=#000000;")
LIFE = "html=1;endArrow=none;dashed=1;dashPattern=4 4;strokeColor=#000000;strokeWidth=1;"
ARROW = "html=1;rounded=0;endArrow=block;endFill=1;strokeColor=#000000;strokeWidth=1.5;"


SPLIT = r"<br\s*/?>|<hr\s*/?>"


def plain(s):
    return re.sub(r"<[^>]+>", "", s)


def cwid(fs, bold=False):
    return fs * (0.60 if bold else 0.56)


def est_lines(label, w, fs=FS, pad=16):
    n = 0
    for ln in re.split(SPLIT, label):
        t = plain(ln)
        per = max(1, int((w - pad) / cwid(fs, "<b>" in ln)))
        n += max(1, math.ceil(len(t) / per))
    return n


def est_h(label, w, fs=FS, pad=12):
    return int(est_lines(label, w, fs) * fs * 1.4 + pad)


def est_w(label, fs=FS, pad=16):
    return int(max(len(plain(l)) * cwid(fs, "<b>" in l) for l in re.split(SPLIT, label)) + pad)


def wrap_lines(label, w, fs=FS, pad=16):
    out = []
    for ln in re.split(SPLIT, label):
        t = plain(ln)
        per = max(1, int((w - pad) / cwid(fs, "<b>" in ln)))
        words, cur = t.split(" "), ""
        for wd in words:
            if cur and len(cur) + 1 + len(wd) > per:
                out.append(cur)
                cur = wd
            else:
                cur = (cur + " " + wd).strip()
        out.append(cur)
    return out


class D:
    def __init__(self, name, title=None):
        self.name = name
        self.cells = []
        self.n = 0
        if title:
            self.text(title, 40, 12, max(600, est_w(title, 22) + 20), 40, TITLE, fs=22)

    def _id(self):
        self.n += 1
        return f"c{self.n}"

    def vertex(self, kind, label, x, y, w, h, style, fs=FS, bg=False):
        cid = self._id()
        self.cells.append(dict(id=cid, kind=kind, label=label, x=x, y=y, w=w, h=h, style=style, fs=fs, bg=bg))
        return cid

    def box(self, label, x, y, w, h=None, style=BLUE, fs=FS):
        if h is None:
            h = max(40, est_h(label, w, fs, 16))
        return self.vertex("box", label, x, y, w, h, style, fs)

    def ellipse(self, label, x, y, w, h, style):
        return self.vertex("ellipse", label, x, y, w, h, "ellipse;whiteSpace=wrap;html=1;strokeWidth=1.5;" + FONT + style)

    def zone(self, label, x, y, w, h):
        return self.vertex("zone", label, x, y, w, h, ZONE, bg=True)

    def note(self, label, x, y, w, h=None):
        if h is None:
            h = est_h(label, w - 12, 14, 14)
        return self.vertex("note", label, x, y, w, h, NOTE, fs=14)

    def text(self, label, x, y, w, h=None, style=TEXT, fs=14):
        if h is None:
            h = est_h(label, w, fs, 6)
        return self.vertex("text", label, x, y, w, h, style, fs)

    def get(self, cid):
        return next(c for c in self.cells if c["id"] == cid)

    def edge(self, src, tgt, p0, p1, via=(), dashed=False, extra="", arrow_start=None):
        s, t = self.get(src), self.get(tgt)
        fx = lambda c, p: ((p[0] - c["x"]) / c["w"], (p[1] - c["y"]) / c["h"])
        ex, ey = fx(s, p0)
        nx, ny = fx(t, p1)
        base = ARROW.replace("endArrow=block;endFill=1;", "") if "endArrow=" in extra else ARROW
        style = (base + f"edgeStyle=none;exitX={ex:.4f};exitY={ey:.4f};exitDx=0;exitDy=0;entryX={nx:.4f};entryY={ny:.4f};"
                 "entryDx=0;entryDy=0;" + ("dashed=1;" if dashed else "") + extra)
        cid = self._id()
        self.cells.append(dict(id=cid, kind="edge", src=src, tgt=tgt, pts=[p0, *via, p1], style=style))
        return cid

    def line(self, p0, p1, style=ARROW, dashed=False, tag="arrow"):
        cid = self._id()
        self.cells.append(dict(id=cid, kind="line", pts=[p0, p1], style=style + ("dashed=1;" if dashed else ""), tag=tag))
        return cid

    def elabel(self, label, cx, cy, w=None, fs=14, align="c"):
        """Edge label as a free text box centred (or left-anchored) at (cx, cy)."""
        if w is None:
            w = est_w(label, fs, 14)
        h = est_h(label, w, fs, 6)
        x = cx - w / 2 if align == "c" else cx
        return self.text(label, x, cy - h / 2, w, h, TEXT if align == "c" else TEXTL, fs)

    # ---------- output ----------
    def diagram_xml(self, index):
        parts = []
        for c in self.cells:
            lab = escape(c.get("label", ""), {'"': "&quot;"})
            if c["kind"] in ("box", "ellipse", "zone", "note", "text"):
                parts.append(
                    f'<mxCell id="{c["id"]}" value="{lab}" style="{c["style"]}" vertex="1" parent="1">'
                    f'<mxGeometry x="{c["x"]:.0f}" y="{c["y"]:.0f}" width="{c["w"]:.0f}" height="{c["h"]:.0f}" as="geometry"/></mxCell>')
            elif c["kind"] == "edge":
                pts = "".join(f'<mxPoint x="{p[0]:.0f}" y="{p[1]:.0f}"/>' for p in c["pts"][1:-1])
                arr = f'<Array as="points">{pts}</Array>' if pts else ""
                parts.append(
                    f'<mxCell id="{c["id"]}" value="" style="{c["style"]}" edge="1" parent="1" source="{c["src"]}" target="{c["tgt"]}">'
                    f'<mxGeometry relative="1" as="geometry">{arr}</mxGeometry></mxCell>')
            else:
                p0, p1 = c["pts"]
                parts.append(
                    f'<mxCell id="{c["id"]}" value="" style="{c["style"]}" edge="1" parent="1">'
                    f'<mxGeometry relative="1" as="geometry"><mxPoint x="{p0[0]:.0f}" y="{p0[1]:.0f}" as="sourcePoint"/>'
                    f'<mxPoint x="{p1[0]:.0f}" y="{p1[1]:.0f}" as="targetPoint"/></mxGeometry></mxCell>')
        return ('<diagram id="page%d" name="%s">'
                '<mxGraphModel dx="1400" dy="900" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" '
                'fold="1" page="0" pageScale="1" pageWidth="1600" pageHeight="1200" math="0" shadow="0">'
                '<root><mxCell id="0"/><mxCell id="1" parent="0"/>%s</root></mxGraphModel></diagram>'
                % (index, escape(self.name), "".join(parts)))

    # ---------- lint ----------
    def lint(self):
        issues = []
        verts = [c for c in self.cells if c["kind"] in ("box", "ellipse", "note", "text")]
        rect = lambda c, k=2: (c["x"] + k, c["y"] + k, c["x"] + c["w"] - k, c["y"] + c["h"] - k)

        def inter(a, b):
            return a[0] < b[2] and b[0] < a[2] and a[1] < b[3] and b[1] < a[3]

        # text overflow
        for c in verts:
            if not plain(c["label"]).strip():
                continue
            w = c["w"] * (0.74 if c["kind"] == "ellipse" else 1)
            need = est_h(c["label"], w - (12 if c["kind"] == "note" else 0), c["fs"], 6)
            if need > c["h"] + 2:
                issues.append(f"OVERFLOW '{plain(c['label'])[:40]}' need {need} have {c['h']:.0f}")
        # vertex overlap
        for i, a in enumerate(verts):
            for b in verts[i + 1:]:
                if inter(rect(a), rect(b)):
                    issues.append(f"OVERLAP '{plain(a['label'])[:28]}' x '{plain(b['label'])[:28]}'")
        # edges vs vertices
        for e in self.cells:
            if e["kind"] not in ("edge", "line"):
                continue
            if e["kind"] == "line" and e.get("tag") == "life":
                continue
            skip = {e.get("src"), e.get("tgt")}
            pts = e["pts"]
            for a, b in zip(pts, pts[1:]):
                steps = max(2, int(math.hypot(b[0] - a[0], b[1] - a[1]) / 3))
                for k in range(steps + 1):
                    px = a[0] + (b[0] - a[0]) * k / steps
                    py = a[1] + (b[1] - a[1]) * k / steps
                    for v in verts:
                        if v["id"] in skip:
                            continue
                        r = rect(v, 3)
                        if r[0] < px < r[2] and r[1] < py < r[3]:
                            issues.append(f"EDGE crosses '{plain(v['label'])[:35]}' at ({px:.0f},{py:.0f})")
                            break
                    else:
                        continue
                    break
        return sorted(set(issues))

    # ---------- preview ----------
    def render(self, path):
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        from matplotlib.patches import Ellipse, FancyBboxPatch, Rectangle

        xs = [0]
        ys = [0]
        for c in self.cells:
            if "x" in c:
                xs.append(c["x"] + c["w"])
                ys.append(c["y"] + c["h"])
            else:
                xs += [p[0] for p in c["pts"]]
                ys += [p[1] for p in c["pts"]]
        W, H = max(xs) + 40, max(ys) + 40
        fig = plt.figure(figsize=(W / 100, H / 100), dpi=100)
        ax = fig.add_axes([0, 0, 1, 1])
        ax.set_xlim(0, W)
        ax.set_ylim(H, 0)
        ax.axis("off")
        col = lambda st, k, d: (re.search(k + r"=(#[0-9a-fA-F]{6})", st) or [None, d])[1]
        for zi, c in enumerate(self.cells):
            st = c["style"]
            z = 1 + zi * 0.01
            if c["kind"] in ("box", "ellipse", "note", "zone") or (c["kind"] == "text" and "fillColor=" in st):
                fill, stroke = col(st, "fillColor", "#ffffff"), col(st, "strokeColor", "#666666")
                if c["kind"] == "ellipse":
                    ax.add_patch(Ellipse((c["x"] + c["w"] / 2, c["y"] + c["h"] / 2), c["w"], c["h"], fc=fill, ec=stroke, lw=1.5, zorder=z))
                elif c["kind"] == "text":
                    ax.add_patch(Rectangle((c["x"], c["y"]), c["w"], c["h"], fc=fill, ec="none", zorder=z))
                else:
                    ax.add_patch(FancyBboxPatch((c["x"], c["y"]), c["w"], c["h"], boxstyle="round,pad=0,rounding_size=6",
                                                fc=fill, ec=stroke, lw=1.2 + (1.2 if "strokeWidth=3" in st else 0), ls=(":" if "dashPattern=1 3" in st else "--" if ("dashed=1" in st or c["kind"] == "zone") else "-"), zorder=z))
            if c["kind"] in ("box", "ellipse", "note", "zone", "text") and plain(c["label"]).strip():
                w = c["w"] * (0.74 if c["kind"] == "ellipse" else 1)
                lines = wrap_lines(c["label"], w - (12 if c["kind"] == "note" else 0), c["fs"])
                left = "align=left" in st
                top = "verticalAlign=top" in st
                lh = c["fs"] * 1.4
                if c["kind"] == "zone":
                    top = True
                total = lh * len(lines)
                y0 = c["y"] + (6 if top else (c["h"] - total) / 2)
                for i, ln in enumerate(lines):
                    xx = c["x"] + (10 if left else c["w"] / 2)
                    ax.text(xx, y0 + lh * i + lh / 2, ln, ha="left" if left else "center", va="center",
                            fontsize=c["fs"] * 0.72, color="#1a1a1a", fontfamily="DejaVu Sans",
                            fontweight="bold" if "fontStyle=1" in st or "<b>" in c["label"] and not left else "normal", zorder=z + 0.005)
            if c["kind"] in ("edge", "line"):
                pts = c["pts"]
                dashed = "dashed=1" in st
                color = col(st, "strokeColor", "#333333")
                for a, b in zip(pts, pts[1:]):
                    ax.plot([a[0], b[0]], [a[1], b[1]], color=color, lw=1.4, ls="--" if dashed else "-", zorder=z)
                if "endArrow=block" in st:
                    a, b = pts[-2], pts[-1]
                    ax.annotate("", xy=b, xytext=a, arrowprops=dict(arrowstyle="-|>", color=color, lw=0, mutation_scale=14), zorder=z)
        fig.savefig(path)
        plt.close(fig)


def sequence(d, actors, msgs, gap=260, x0=50, top=60, aw=180, fs=14):
    xs = {}
    for i, (key, label, style) in enumerate(actors):
        x = x0 + i * gap
        xs[key] = x + aw / 2
    ah = max(50, max(est_h(label, aw, 15, 14) for _, label, _ in actors))
    y = top + ah + 24
    rows = []
    for m in msgs:
        if m[0] == "note":
            _, text, a, b = m
            left = min(xs[a], xs[b]) - aw / 2 + 12
            w = abs(xs[b] - xs[a]) + aw - 24
            h = est_h(text, w - 12, fs, 14)
            rows.append(("note", y, left, w, h, text))
            y += h + 18
        else:
            src, tgt, label = m[0], m[1], m[2]
            reply = len(m) > 3 and m[3] == "reply"
            span = abs(xs[tgt] - xs[src])
            w = span - 20
            lh = est_h(label, w, fs, 4)
            rows.append(("msg", y, src, tgt, label, w, lh, reply))
            y += lh + 8 + 24
    bottom = y
    for key, label, style in actors:
        d.line((xs[key], top + ah), (xs[key], bottom), LIFE, tag="life")
    for key, label, style in actors:
        d.box(label, xs[key] - aw / 2, top, aw, ah, style, fs=15)
    for r in rows:
        if r[0] == "note":
            _, yy, left, w, h, text = r
            d.note(text, left, yy, w, h)
        else:
            _, yy, src, tgt, label, w, lh, reply = r
            cx = (xs[src] + xs[tgt]) / 2
            d.text(label, cx - w / 2, yy, w, lh, TEXT + "fillColor=#ffffff;", fs)
            ly = yy + lh + 8
            d.line((xs[src], ly), (xs[tgt], ly), ARROW, dashed=reply)
    return bottom


# ---------- books: one .drawio file with several pages ----------
BOOKS = {}


def done(d, fname):
    BOOKS.setdefault(fname, []).append(d)


def write_books(out, prev):
    out, prev = Path(out), Path(prev)
    report = []
    for fname, pages in BOOKS.items():
        body = "".join(p.diagram_xml(i + 1) for i, p in enumerate(pages))
        (out / fname).write_text('<mxfile host="drawio" agent="generated">' + body + "</mxfile>", encoding="utf-8")
        for i, p in enumerate(pages):
            try:
                p.render(prev / f"{fname.replace('.drawio', '')}-p{i + 1}.png")
            except ModuleNotFoundError:
                pass  # không có matplotlib: bỏ qua ảnh xem trước, vẫn sinh .drawio và kiểm lỗi bố cục
            report.append((f"{fname} / page {i + 1}: {p.name}", p.lint()))
    return report
