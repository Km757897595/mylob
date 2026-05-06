#!/usr/bin/env python3
from __future__ import annotations

"""将 softcopyright-export 生成的 src 副本合并为一个 .txt，并按「每页若干行 × 前几页 / 后几页」截取。

常见于软著材料：源代码前连续若干页 + 后连续若干页（页数与每页行数以登记机关当时要求为准）。
默认：每页 50 行、前 30 页、后 30 页。

依赖：请先运行 export.py 生成 softcopyright-source/。

示例：
  python3 scripts/softcopyright-export/build_submission_txt.py
  python3 scripts/softcopyright-export/build_submission_txt.py \\
    --input ./softcopyright-source/src --out ./软著源代码节选.txt \\
    --lines-per-page 50 --front-pages 30 --back-pages 30
"""

import argparse
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_INPUT = REPO_ROOT / "softcopyright-source" / "src"
DEFAULT_OUT = REPO_ROOT / "软著源代码节选.txt"

# 参与合并的扩展名（与登记用「程序源代码」体裁一致）
TEXT_SUFFIXES = (
    ".ts",
    ".tsx",
    ".mts",
    ".cts",
    ".js",
    ".jsx",
    ".mjs",
    ".cjs",
    ".css",
    ".scss",
    ".less",
    ".vue",
    ".json",
)


def collect_files(root: Path) -> list[Path]:
    if not root.is_dir():
        raise SystemExit(f"目录不存在: {root}")
    out: list[Path] = []
    for path in sorted(root.rglob("*")):
        if not path.is_file():
            continue
        if path.name.startswith("."):
            continue
        if path.suffix.lower() not in TEXT_SUFFIXES:
            continue
        if path.suffix.endswith(".map") or ".min." in path.name.lower():
            continue
        out.append(path)
    return out


def read_all_lines(files: list[Path], root: Path) -> list[str]:
    lines: list[str] = []
    for fp in files:
        rel = fp.relative_to(root).as_posix()
        sep = "=" * 78
        lines.append(sep)
        lines.append(f"FILE: {rel}")
        lines.append(sep)
        try:
            raw = fp.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            raw = fp.read_text(encoding="utf-8", errors="replace")
        for line in raw.splitlines():
            lines.append(line)
        lines.append("")  # 文件末尾空一行
    return lines


def build_excerpt(lines: list[str], lines_per_page: int, front_pages: int, back_pages: int) -> tuple[str, dict[str, int]]:
    n = len(lines)
    front_take = lines_per_page * front_pages
    back_take = lines_per_page * back_pages

    meta: dict[str, int] = {
        "total_lines": n,
        "lines_per_page": lines_per_page,
        "front_pages": front_pages,
        "back_pages": back_pages,
        "front_lines_taken": 0,
        "back_lines_taken": 0,
        "omitted_middle": 0,
    }

    header = [
        "【说明】本文为程序源代码节选文本（UTF-8）。"
        "「每页行数×页数」仅为数学换算，排版到 Word/PDF 时请按版权中心当期要求。\n\n",
        f"【合并后总行数】{n}\n",
        (
            f"【截取设定】按每页 {lines_per_page} 行、前连续 {front_pages} 页、后连续 {back_pages} 页 "
            f"（等价于前至多 {front_take} 行 + 后至多 {back_take} 行）。\n\n"
        ),
    ]

    if n <= front_take + back_take:
        meta["front_lines_taken"] = n
        meta["back_lines_taken"] = 0
        body_lines = lines
        header.append(
            f"【节选方式】全文未超过「前+后」行数上限，以下为完整合并内容（共 {n} 行）。\n\n"
        )
    else:
        head = lines[:front_take]
        tail = lines[-back_take:]
        meta["front_lines_taken"] = len(head)
        meta["back_lines_taken"] = len(tail)
        meta["omitted_middle"] = n - front_take - back_take

        omit_msg = f"…………………… 中间省略 {meta['omitted_middle']} 行 ……………………"
        body_lines = [*head, omit_msg, *tail]
        header.append(
            f"【节选方式】取合并结果的前 {front_take} 行与后 {back_take} 行，中间不重复收录。\n\n"
        )

    text = "".join(header) + "\n".join(body_lines)
    if not text.endswith("\n"):
        text += "\n"
    return text, meta


def main() -> None:
    ap = argparse.ArgumentParser(description="合并 src 源码为单文件并按前后页截取")
    ap.add_argument(
        "--input",
        type=Path,
        default=DEFAULT_INPUT,
        help="脱敏后的 src 目录（默认 softcopyright-source/src）",
    )
    ap.add_argument(
        "--out",
        type=Path,
        default=DEFAULT_OUT,
        help="输出 .txt 路径",
    )
    ap.add_argument("--lines-per-page", type=int, default=50, help="视为「一页」的行数（默认 50）")
    ap.add_argument("--front-pages", type=int, default=30, help="截取前连续的页数（默认 30）")
    ap.add_argument("--back-pages", type=int, default=30, help="截取后连续的页数（默认 30）")
    args = ap.parse_args()

    root = args.input.expanduser().resolve()
    files = collect_files(root)
    if not files:
        raise SystemExit(f"未找到可合并的源文件（{TEXT_SUFFIXES}）: {root}")

    lines = read_all_lines(files, root)
    text, meta = build_excerpt(lines, args.lines_per_page, args.front_pages, args.back_pages)

    out_path = args.out.expanduser().resolve()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(text, encoding="utf-8")

    print(f"已写入: {out_path}")
    print(f"合并文件数: {len(files)}，合并总行数: {meta['total_lines']}")
    if meta.get("omitted_middle"):
        print(f"已按前 {meta['front_lines_taken']} 行 + 后 {meta['back_lines_taken']} 行截取，中间省略 {meta['omitted_middle']} 行。")
    else:
        print("未截取：全文较短，已写入完整合并内容。")


if __name__ == "__main__":
    main()
