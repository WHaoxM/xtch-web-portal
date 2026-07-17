# -*- coding: utf-8 -*-
"""Move internal extraction/review notes out of traveler-facing day.notes."""
import json
import re
from pathlib import Path

ROOT = Path(r"d:\AGeneral Workspace\xjch2026\xtch-web-portal")
DRAFTS = ROOT / "data/route-itinerary-drafts/drafts"

def is_internal(note: str) -> bool:
    strong = [
        "CRITICAL",
        "MinerU",
        "source-map",
        "OCR",
        "PDF/MD",
        "routePdfDetails",
        "Chinese companion",
        "Where Yading Meets Jiuzhaigou.pdf",
        "needs human review",
        "table cell conflicting",
        "Brief table",
        "fieldEvidence",
        "未提及",
        "留空",
        "do not publish",
        "pending_review",
        "Extraction",
        "sum-up",
        "MD Day",
        "MD overview",
        "MD warns",
        "MD exclusions",
        "MD says",
        "MD:",
        "MD ",
        "per source-map",
        "flagged",
        "authority",
        "Tour-level meals:",
        "Day text:",
        "Cost includes:",
    ]
    lower = note
    return any(token in lower for token in strong)

EXPERIENCE_INTERNAL = re.compile(
    r"\s*(built from the original route PDF\.?|from the (original )?PDF\.?|"
    r"extracted from the PDF,?|The PDF route |The extracted PDF itinerary )",
    re.I,
)

stats = {"files": 0, "notes_kept": 0, "notes_moved": 0, "experience_touched": 0}

for path in sorted(DRAFTS.glob("*.json")):
    data = json.loads(path.read_text(encoding="utf-8"))
    stats["files"] += 1
    changed = False

    new_exp = []
    for line in data.get("experience") or []:
        if EXPERIENCE_INTERNAL.search(line) or "original route PDF" in line or "from the PDF" in line:
            cleaned = re.sub(
                r"(,? )?(built from the original route PDF|from the original PDF|"
                r"extracted from the PDF|The PDF route |The extracted PDF itinerary )",
                " ",
                line,
                flags=re.I,
            )
            cleaned = re.sub(r"\s{2,}", " ", cleaned).strip(" ,.")
            if cleaned:
                if not cleaned.endswith("."):
                    cleaned += "."
                # Capitalize first letter if needed
                cleaned = cleaned[0].upper() + cleaned[1:]
                new_exp.append(cleaned)
            stats["experience_touched"] += 1
            changed = True
        else:
            new_exp.append(line)
    data["experience"] = new_exp

    for day in data.get("days") or []:
        kept = []
        moved = []
        for note in day.get("notes") or []:
            if is_internal(note):
                moved.append(note)
            else:
                kept.append(note)
        if moved:
            fe = day.setdefault("fieldEvidence", {})
            prev = fe.get("reviewNotesMoved") or []
            fe["reviewNotesMoved"] = prev + moved
            day["notes"] = kept
            stats["notes_moved"] += len(moved)
            stats["notes_kept"] += len(kept)
            changed = True
        else:
            stats["notes_kept"] += len(kept)

    if changed:
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print("cleaned", path.name)
    else:
        print("unchanged", path.name)

print(json.dumps(stats, indent=2))
