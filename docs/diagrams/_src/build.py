"""Regenerate all draw.io books. Usage: py -3 -I build.py <out_dir> <preview_dir>"""
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
here = Path(__file__).parent
sys.path.insert(0, str(here))
import dfw  # noqa

out, prev = Path(sys.argv[1]), Path(sys.argv[2])
out.mkdir(parents=True, exist_ok=True)
prev.mkdir(parents=True, exist_ok=True)
for part in ("build1.py", "build2.py"):
    exec(compile((here / part).read_text(encoding="utf-8"), part, "exec"), {"__name__": "__build__", "__file__": str(here / part)})
bad = 0
for name, issues in dfw.write_books(out, prev):
    print(name, "OK" if not issues else f"{len(issues)} issue(s)")
    for i in issues:
        bad += 1
        print("    ", i)
print("lint issues:", bad)
