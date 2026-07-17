from __future__ import annotations

import json
import sys
from pathlib import Path


def main() -> int:
    if len(sys.argv) < 5:
        print(
            "Usage: mineru_api_runner.py <input-file> <output-dir> <backend> <method>",
            file=sys.stderr,
        )
        return 2

    input_file = Path(sys.argv[1]).resolve()
    output_dir = Path(sys.argv[2]).resolve()
    backend = sys.argv[3]
    method = sys.argv[4]

    if not input_file.exists():
        print(f"Input file does not exist: {input_file}", file=sys.stderr)
        return 2

    from mineru.cli.common import do_parse, read_fn
    from mineru.utils.enum_class import MakeMode

    file_stem = input_file.stem
    extension = input_file.suffix.lower().lstrip(".") or "pdf"

    output_dir.mkdir(parents=True, exist_ok=True)
    file_bytes = read_fn(str(input_file), extension)

    do_parse(
        output_dir=str(output_dir),
        pdf_file_names=[file_stem],
        pdf_bytes_list=[file_bytes],
        p_lang_list=["ch"],
        backend=backend,
        parse_method=method,
        f_draw_layout_bbox=False,
        f_draw_span_bbox=False,
        f_dump_md=True,
        f_dump_middle_json=True,
        f_dump_model_output=False,
        f_dump_orig_pdf=False,
        f_dump_content_list=True,
        f_make_md_mode=MakeMode.MM_MD,
    )

    result_files = sorted(str(path.relative_to(output_dir)) for path in output_dir.rglob("*") if path.is_file())
    print(
        json.dumps(
            {
                "status": "ok",
                "input": str(input_file),
                "output_dir": str(output_dir),
                "result_files": result_files,
            },
            ensure_ascii=False,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
