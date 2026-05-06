#!/usr/bin/env python3
from __future__ import annotations

"""导出用于著作权登记的源代码副本（主仓库不修改）。
- 仅复制仓库根目录下 **src/** 内文件（保持 `src/...` 目录结构）；
- 在 src 内排除 node_modules、.git、构建产物等常见目录；
- 对标识符、注释、路径、MIME 等做批量脱敏，使输出中不含连续「lobe」字母串及 lobechat/lobehub 等典型品牌写法；
- 校验：品牌关键词 + 去「globe」单词后检查是否仍含「lobe」。

登记时请按当地版权中心要求从输出目录择要排版或打印。

用法：python3 scripts/softcopyright-export/export.py --out ./softcopyright-source
合并为单份 .txt（前后页节选）：见同目录 build_submission_txt.py
"""

DEFAULT_SRC_DIR = "src"

import argparse
import os
import re
import shutil
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_OUT = REPO_ROOT / "softcopyright-source"

IGNORE_DIR_NAMES = frozenset(
    {
        "node_modules",
        ".git",
        ".next",
        "dist",
        "coverage",
        ".pnpm-store",
        "test-output",
        ".umi",
        ".umi-production",
        ".umi-test",
        "__pycache__",
        ".venv",
        "venv",
        ".turbo",
        ".cache",
        "es",
        "lib",
        "changelog",
        "e2e",
        ".github",
        ".changeset",
    }
)

BINARY_SUFFIXES = (
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".ico",
    ".woff",
    ".woff2",
    ".ttf",
    ".otf",
    ".eot",
    ".pdf",
    ".zip",
    ".wasm",
    ".mp4",
    ".webm",
    ".lock",
    ".tar",
    ".gz",
    ".7z",
    ".parquet",
    ".sqlite",
    ".db",
    ".mmap",
    ".tsbuildinfo",
)


def _string_replacements() -> list[tuple[str, str]]:
    pairs: list[tuple[str, str]] = [
        ("https://www.lobehub.com", "https://docs.internal.local"),
        ("https://app.lobehub.com", "https://app.internal.local"),
        ("https://lobehub.com", "https://docs.internal.local"),
        ("http://lobehub.com", "http://docs.internal.local"),
        ("hub-apac-1.lobeobjects.space", "hub-apac-1.cdn.internal.local"),
        ("lobeobjects.space", "cdn.internal.local"),
        ("github.com/lobehub/lobe-chat", "github.com/workspace/unified-chat"),
        ("github.com/lobehub/", "github.com/workspace/"),
        ("git@github.com:lobehub/", "git@github.com:workspace/"),
        ("upstream_sync_repo: lobehub/lobehub", "upstream_sync_repo: workspace/app"),
        ("lobehub.com", "internal.local"),
        ("https://deploylobe", "https://deployapp"),
        ("/deploylobe.svg", "/deploybadge.svg"),
        ("@lobechat/", "@workspace/"),
        ("@lobehub/", "@uisupport/"),
        ("@lobehub", "@publisher"),
        ("builtins.lobe-", "builtins.builtin-"),
        ("LOBE_THEME_APP_ID", "APP_THEME_ID"),
        ("lobechat:", "appchat:"),
        ("lobeEnv", "runtimeEnv"),
        ("steps.lobeChat", "steps.unifiedChat"),
        ("platform.steps.lobeChat", "platform.steps.unifiedChat"),
        ("askLobeAI", "askUnifiedAI"),
        ("custom_sd_vae_lobe", "custom_sd_vae_app"),
        ("custom_sd_lobe", "custom_sd_app"),
        ("LobeToolsManifest", "AppToolsManifest"),
        ("LobeBuiltinTool", "AppBuiltinTool"),
        ("lobeChat", "unifiedChat"),
        ("LobeChat", "UnifiedChat"),
        ("lobechat", "unifiedchat"),
        ("lobe-network", "app-network"),
        ("lobe-rustfs-init", "app-rustfs-init"),
        ("lobe-rustfs", "app-rustfs"),
        ("lobe-searxng", "app-searxng"),
        ("lobe-postgres", "app-postgres"),
        ("lobe-redis", "app-redis"),
        ('rustfs/lobe"', 'rustfs/app"'),
        ("rustfs/lobe", "rustfs/app"),
        ('  lobe:', '  appsvc:'),
        ("badge-lobehub", "badge-publish"),
        ("LobeHub", "AIServiceHub"),
        ("Lobechat", "Unifiedchat"),
        ("Lobehub", "MarketHub"),
        ("lobehub", "aiservicehub"),
        ("LobeIcon", "AppIcon"),
        ("LOBE_CHAT", "UNIFIED_CHAT"),
        ("MEMORY_USER_MEMORY_LOBEHUB_BASE_URL", "MEMORY_USER_MEMORY_APPHUB_BASE_URL"),
        ("github_lobe-chat", "github_unified-chat"),
        ("LOBEHUB_SKILL_PROVIDERS", "MARKET_SKILL_PROVIDERS"),
        ("LOBEHUB_", "APPHUB_"),
        ("lobe-server:", "runtime-server:"),
        ("lobe-server", "runtime-server"),
        ("getLobehubDir", "getConfigHubDir"),
        ("LOBE_PORT", "APP_PORT"),
        ("LOBE_DB", "APP_DB"),
        ("LOBE_IMAGE", "APP_IMAGE"),
        ("LOBE-", "TASK-"),
        ("RUSTFS_LOBE", "RUSTFS_APP"),
        ("(lobe Stärken, schlage", "(bewerte Stärken, schlage"),
        (":globe_with_meridians:", ":world-map:"),
        ("useOnLobeAI", "useOnUnifiedAI"),
        ("lobeArtifact", "appArtifact"),
        ("lobeThinking", "appThinking"),
        ("LobeToolIdentifier", "BuiltinToolIdentifier"),
        ("LobeToolsInspectors", "BuiltinToolsInspectors"),
        ("lobe-tools", "builtin-tools"),
        ("lobe-skill-store", "unified-skill-store"),
    ]
    pairs.sort(key=lambda item: len(item[0]), reverse=True)
    return pairs


_STRING_PAIRS = _string_replacements()


def _is_probably_binary(path: Path) -> bool:
    n = path.name.lower()
    if n.endswith(BINARY_SUFFIXES):
        return True
    if n == "bun.lockb":
        return True
    return False


def _sanitize_segments(rel: Path) -> Path:
    parts = []
    for p in rel.parts:
        s = (
            p.replace("lobe-chat", "unified-chat")
            .replace("lobe_ai", "unified_ai")
            .replace("lobe-ai", "unified-ai")
            .replace("lobe_chat", "unified_chat")
            .replace("lobe-", "unified-")
            .replace("lobe_", "unified_")
            .replace("LobeArtifact", "AppArtifact")
            .replace("LobeHub", "AppHub")
            .replace("Lobehub", "MarketHub")
            .replace("lobehub", "aiservicehub")
            .replace("lobechat", "unifiedchat")
        )
        parts.append(s)
    return Path(*parts)


def _camel_lobe_prefix(text: str) -> str:
    """将小写前缀 lobeXxx（如 lobeStaticStylish、__lobe_error）改写为内部命名。"""
    text = text.replace("__lobe_", "__app_")
    return re.sub(
        r"(?<![A-Za-z0-9])(lobe)([A-Z][a-zA-Z0-9_]*)",
        lambda m: "app" + m.group(2),
        text,
    )


def _collapse_caps_lobe(text: str) -> str:
    """将 LOBE 作为全大写标识的一部分替换为 APP，反复处理嵌套如 DEFAULT_AGENT_LOBE_SESSION。"""
    prev = None
    while prev != text:
        prev = text
        text = re.sub(r"([A-Za-z0-9_])LOBE([A-Za-z0-9_])", r"\1APP\2", text)
        text = re.sub(r"\bLOBE([A-Za-z0-9_])", r"APP\1", text)
        text = re.sub(r"([A-Za-z0-9_])LOBE\b", r"\1APP", text)
    return text


def _purge_loebe_identifiers(text: str) -> str:
    """消除仍含 contiguous lobe（如 ILobe、Builtins skillId 前缀 lobe-）的标识片段。"""
    text = text.replace("convertOpenAIManifestToLobeManifest", "convertOpenAIManifestToUnifiedManifest")
    text = text.replace("loadLobeUIBuiltinResources", "loadAppUIBuiltinResources")
    text = text.replace("handleUseOnLobeAI", "handleUseOnUnifiedAI")
    text = text.replace("transformMCPToolToLobeAPI", "transformMCPToolToAppAPI")
    text = text.replace("isLobeToolsEnabled", "isBuiltinToolsEnabled")
    text = text.replace("showLobeAI", "showUnifiedAI")
    text = text.replace("AskLobeAI", "AskUnifiedAI")
    text = text.replace("ILobe", "IUnified")
    text = text.replace("AsLobeTools", "AsBuiltinTools")
    text = text.replace("initLobe", "initUnified")
    text = text.replace("`Lobe_${", "`App_${")
    text = text.replace("name: `Lobe_", "name: `App_")
    text = text.replace("'lobe-", "'builtin-")
    text = text.replace('"lobe-', '"builtin-')
    text = text.replace("`lobe-", "`builtin-")
    text = text.replace("application/lobe.", "application/app.")
    text = text.replace("lobe.artifacts", "app.artifacts")
    text = re.sub(r"Globe([A-Z][a-zA-Z0-9]*)", r"Earth\1", text)
    text = re.sub(r"\bGlobe\b", "Earth", text)
    return text


def _transform_text(raw: str) -> str:
    text = raw
    for old, new in _STRING_PAIRS:
        text = text.replace(old, new)
    text = _camel_lobe_prefix(text)
    text = _collapse_caps_lobe(text)
    # LobeFoo、Lobe302AI 等（原 L 后仅大写时无法覆盖数字版本）
    text = re.sub(r"(?<![A-Za-z])Lobe([a-zA-Z0-9][a-zA-Z0-9_]*)", r"Unified\1", text)
    text = _purge_loebe_identifiers(text)
    text = re.sub(r"\bLobe\b", "Unified", text)
    text = re.sub(r"\blobe\b", "unified", text)
    text = _purge_loebe_identifiers(text)
    return text


def _strip_natural_words_with_false_loebe_then_has_lobe(text: str) -> bool:
    """先去掉单词 globe(s)，避免误判；再判定是否仍存在子串 lob e（连着）。"""
    cleaned = re.sub(r"(?i)\bglobe[s]?\b", "", text)
    return "lobe" in cleaned.lower()


def _has_forbidden_brand(text: str) -> bool:
    """品牌相关 + lobe 四字母 contiguous（已对 globe 剥离）。"""
    tl = text.lower()
    if any(x in tl for x in ("lobehub", "lobechat", "lobe-chat", "lobe_chat", "@lobehub", "@lobechat")):
        return True
    return _strip_natural_words_with_false_loebe_then_has_lobe(text)


def _bad_file_basename(name: str) -> bool:
    ln = name.lower()
    return any(x in ln for x in ("lobehub", "lobechat"))


def _filter_dirnames(dirnames: list[str]) -> None:
    keep: list[str] = []
    for d in sorted(dirnames, key=str.lower):
        if d in IGNORE_DIR_NAMES:
            continue
        if d.startswith("."):
            continue
        keep.append(d)
    dirnames[:] = keep


def export_tree(repo_root: Path, dst: Path) -> tuple[int, int]:
    src_root = repo_root / DEFAULT_SRC_DIR
    if not src_root.is_dir():
        raise SystemExit(f"未找到源码目录: {src_root}")

    text_n = 0
    bin_n = 0
    for dirpath, dirnames, filenames in os.walk(src_root, topdown=True):
        _filter_dirnames(dirnames)
        for fname in filenames:
            src_file = Path(dirpath) / fname
            rel = src_file.relative_to(repo_root)
            tgt_rel = _sanitize_segments(rel)
            outfile = dst / tgt_rel
            outfile.parent.mkdir(parents=True, exist_ok=True)
            if _is_probably_binary(src_file):
                shutil.copy2(src_file, outfile)
                bin_n += 1
                continue
            try:
                data = src_file.read_text(encoding="utf-8")
            except (UnicodeDecodeError, OSError):
                shutil.copy2(src_file, outfile)
                bin_n += 1
                continue
            outfile.write_text(_transform_text(data), encoding="utf-8")
            text_n += 1
    return text_n, bin_n


def verify_tree(dst_root: Path) -> list[str]:
    bad: list[str] = []
    for path in sorted(dst_root.rglob("*")):
        if not path.is_file():
            continue
        rel = path.relative_to(dst_root).as_posix()
        if _bad_file_basename(path.name):
            bad.append(rel)
            continue
        if _is_probably_binary(path):
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            continue
        if _has_forbidden_brand(text):
            bad.append(rel)
    return bad


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT, help="输出目录（会先删除）")
    args = ap.parse_args()
    out_dir = args.out.expanduser().resolve()

    if out_dir == REPO_ROOT:
        raise SystemExit("不能使用仓库根目录作为输出")

    if out_dir.exists():
        shutil.rmtree(out_dir)
    out_dir.mkdir(parents=True)

    txt, binary = export_tree(REPO_ROOT, out_dir)
    bad = verify_tree(out_dir)

    print(f"已导出至: {out_dir}")
    print(f"文本处理: {txt} 个文件，二进制直拷: {binary} 个文件")
    if bad:
        print("以下路径仍可能含品牌字样（lobehub / lobechat / Lobe），请扩充替换表或人工处理：")
        for p in bad[:80]:
            print(" ", p)
        if len(bad) > 80:
            print(f"  （共 {len(bad)} 个）")
        raise SystemExit(1)
    print("校验通过：未检出 lobehub、lobechat、Lobe 品牌等字样。")


if __name__ == "__main__":
    main()
