#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
高德 POI 清洗数据 → Outio Supabase destinations 表批量导入脚本

用法:
    # 100 条试跑
    SUPABASE_SERVICE_KEY=eyJ... python3 import_gaode.py --limit 100

    # 全量
    SUPABASE_SERVICE_KEY=eyJ... python3 import_gaode.py

    # 不写库，只看转换结果
    python3 import_gaode.py --limit 5 --dry-run

依赖:
    pip install --break-system-packages requests

注意:
    - 用 service_role key（绕过 RLS）。anon key 默认被 RLS 拦住，无法 INSERT。
    - source_id 已存在的记录自动跳过（每批先 SELECT 一次再 POST）。
    - 单批失败不中断整体，仅打印错误后继续下一批。
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import sys
import time
from collections.abc import Iterable

import requests

# ---------------------------------------------------------------------------
# 配置
# ---------------------------------------------------------------------------
SUPABASE_URL = os.environ.get(
    "SUPABASE_URL", "https://ulwzcvbvqvcmrgxvweev.supabase.co"
).rstrip("/")
# 优先 service_role（写权限），缺失则用 anon key（只能 SELECT，写会 401）
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get(
    "SUPABASE_ANON_KEY"
)
if not SUPABASE_KEY:
    print(
        "❌ 必须设置 SUPABASE_SERVICE_KEY 或 SUPABASE_ANON_KEY 环境变量",
        file=sys.stderr,
    )
    sys.exit(1)

DEFAULT_CSV = "/home/duan/ai-workspace/destinations/gaode_final.csv"
TABLE = "destinations"
BATCH_SIZE = 500
PROGRESS_EVERY = 5000


# ---------------------------------------------------------------------------
# 字段清洗
# ---------------------------------------------------------------------------
def clean_str(val: str | None) -> str | None:
    """空字符串 / 'nan' / 仅空白 → None；否则 strip 后返回"""
    if val is None:
        return None
    s = str(val).strip()
    if not s or s.lower() == "nan":
        return None
    return s


def parse_bool(val: str | None) -> bool | None:
    s = clean_str(val)
    if s is None:
        return None
    low = s.lower()
    if low in ("true", "1", "yes", "y", "t"):
        return True
    if low in ("false", "0", "no", "n", "f"):
        return False
    return None


def parse_json_list(val: str | None) -> list[str] | None:
    """CSV 里形如 '["亲子", "老人"]' 的 JSON 字符串 → Python list；空/非法 → None"""
    s = clean_str(val)
    if s is None or s == "[]":
        return None
    try:
        arr = json.loads(s)
    except (json.JSONDecodeError, ValueError):
        return None
    if not isinstance(arr, list):
        return None
    out = [str(x).strip() for x in arr if str(x).strip()]
    return out or None


def first_of(val: str | None) -> str | None:
    """type2/type3 多数情况是单值；偶尔是 JSON list，取首项"""
    s = clean_str(val)
    if s is None:
        return None
    if s.startswith("[") and s.endswith("]"):
        arr = parse_json_list(s)
        return arr[0] if arr else None
    return s


def derive_province(cityname: str | None) -> str:
    """北京市/天津市保留；其他默认河北省（数据集是京津冀范围）"""
    if not cityname:
        return "河北省"
    if "北京" in cityname:
        return "北京市"
    if "天津" in cityname:
        return "天津市"
    return "河北省"


def parse_phone(val: str | None) -> str | None:
    s = clean_str(val)
    if s is None or s == "[]":
        return None
    return s


def parse_location(wgslng: str | None, wgslat: str | None) -> str | None:
    """
    返回 EWKT，PostgREST 会隐式转 geography(POINT,4326)。
    格式: 'SRID=4326;POINT(lng lat)'
    """
    sx, sy = clean_str(wgslng), clean_str(wgslat)
    if not sx or not sy:
        return None
    try:
        lng, lat = float(sx), float(sy)
    except ValueError:
        return None
    if not (-180.0 <= lng <= 180.0 and -90.0 <= lat <= 90.0):
        return None
    if lng == 0.0 and lat == 0.0:
        return None  # 高德空点
    return f"SRID=4326;POINT({lng} {lat})"


# ---------------------------------------------------------------------------
# 行映射
# ---------------------------------------------------------------------------
def transform(row: dict) -> dict | None:
    """CSV row → destinations 表 INSERT payload；缺关键字段时返回 None"""
    uid = clean_str(row.get("uid"))
    name = clean_str(row.get("name"))
    cityname = clean_str(row.get("cityname"))
    if not uid or not name or not cityname:
        return None

    return {
        "source_id": uid,
        "name": name,
        "country": "中国",
        "province": derive_province(cityname),
        "city": cityname,
        "district": clean_str(row.get("adname")),
        "address": clean_str(row.get("address")),
        "location": parse_location(row.get("wgslng"), row.get("wgslat")),
        "main_category": clean_str(row.get("main_category")) or "其他",
        "sub_category": first_of(row.get("type2")),
        "detail_type": first_of(row.get("type3")),
        "phone": parse_phone(row.get("tel")),
        "suitable_for": parse_json_list(row.get("suitable_for")),
        "child_friendly": parse_bool(row.get("child_friendly")),
        "best_season": parse_json_list(row.get("best_season")),
        "indoor_outdoor": clean_str(row.get("indoor_outdoor")),
        "description": clean_str(row.get("description")),
        "data_source": "gaode_poi",
    }


# ---------------------------------------------------------------------------
# Supabase REST 调用
# ---------------------------------------------------------------------------
class SupabaseClient:
    def __init__(self, url: str, key: str):
        self.url = url
        self.key = key
        self.s = requests.Session()
        self.s.headers.update(
            {
                "apikey": key,
                "Authorization": f"Bearer {key}",
                "Content-Type": "application/json",
            }
        )

    def table_count(self) -> int | None:
        r = self.s.get(
            f"{self.url}/rest/v1/{TABLE}",
            params={"select": "source_id"},
            headers={"Prefer": "count=exact", "Range": "0-0"},
            timeout=15,
        )
        if r.status_code >= 400:
            print(f"❌ 表访问失败 {r.status_code}：{r.text[:300]}", file=sys.stderr)
            return None
        cr = r.headers.get("Content-Range", "*/0")
        try:
            return int(cr.split("/")[-1])
        except ValueError:
            return None

    def existing_source_ids(self, source_ids: Iterable[str]) -> set[str]:
        """对一批 source_id 查询哪些已经存在"""
        ids = list(source_ids)
        if not ids:
            return set()
        # PostgREST in.() — uid 都是 [A-Z0-9] 安全字符，不需要双引号
        in_clause = "in.(" + ",".join(ids) + ")"
        r = self.s.get(
            f"{self.url}/rest/v1/{TABLE}",
            params={"source_id": in_clause, "select": "source_id"},
            timeout=30,
        )
        r.raise_for_status()
        return {row["source_id"] for row in r.json()}

    def insert_batch(self, batch: list[dict]) -> None:
        """批量 INSERT；失败抛 RuntimeError"""
        r = self.s.post(
            f"{self.url}/rest/v1/{TABLE}",
            data=json.dumps(batch, ensure_ascii=False).encode("utf-8"),
            headers={"Prefer": "return=minimal"},
            timeout=120,
        )
        if r.status_code >= 400:
            raise RuntimeError(f"HTTP {r.status_code}: {r.text[:600]}")


# ---------------------------------------------------------------------------
# 主流程
# ---------------------------------------------------------------------------
def main() -> int:
    ap = argparse.ArgumentParser(description="高德 POI → Supabase destinations 导入")
    ap.add_argument("--csv", default=DEFAULT_CSV, help="输入 CSV 路径")
    ap.add_argument(
        "--limit",
        type=int,
        default=0,
        help="只读前 N 行（测试用）；0=全量",
    )
    ap.add_argument(
        "--batch", type=int, default=BATCH_SIZE, help="每批写入条数"
    )
    ap.add_argument(
        "--dry-run",
        action="store_true",
        help="只转换不写库，验证字段映射",
    )
    ap.add_argument(
        "--show-first",
        type=int,
        default=0,
        help="dry-run 时打印前 N 条转换结果",
    )
    args = ap.parse_args()

    if not os.path.isfile(args.csv):
        print(f"❌ CSV 文件不存在：{args.csv}", file=sys.stderr)
        return 1

    client = SupabaseClient(SUPABASE_URL, SUPABASE_KEY)

    # 启动前的健康检查
    if not args.dry_run:
        print(f"→ 连接 {SUPABASE_URL}")
        cnt = client.table_count()
        if cnt is None:
            return 1
        print(f"✓ destinations 表当前记录数：{cnt}")
        # 用单条 INSERT 探测一次写权限（很快回滚不到）
        # 这里不做主动 dry-insert，留给真实批次处理；只在第一批失败时给清晰提示

    # 计数器
    total_read = 0
    total_skip = 0  # 缺关键字段 + CSV 内重复
    total_dup = 0  # 表里已存在
    total_inserted = 0
    total_failed = 0
    seen_uids: set[str] = set()  # CSV 自身去重
    batch: list[dict] = []
    samples: list[dict] = []  # dry-run 显示用
    start = time.time()

    def flush() -> None:
        nonlocal total_inserted, total_dup, total_failed
        if not batch:
            return
        try:
            if args.dry_run:
                total_inserted += len(batch)
            else:
                existing = client.existing_source_ids(
                    rec["source_id"] for rec in batch
                )
                fresh = [rec for rec in batch if rec["source_id"] not in existing]
                total_dup += len(batch) - len(fresh)
                if fresh:
                    client.insert_batch(fresh)
                    total_inserted += len(fresh)
        except Exception as exc:  # 单批失败不影响整体
            total_failed += len(batch)
            print(f"  ⚠ 批次失败（跳过 {len(batch)} 条）：{exc}", file=sys.stderr)
        finally:
            batch.clear()

    print(f"→ 开始读取 {args.csv}（每批 {args.batch}，进度每 {PROGRESS_EVERY} 行）")

    with open(args.csv, encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            total_read += 1
            if args.limit and total_read > args.limit:
                total_read -= 1  # 不计这一条
                break

            rec = transform(row)
            if rec is None:
                total_skip += 1
                continue
            if rec["source_id"] in seen_uids:
                total_skip += 1
                continue
            seen_uids.add(rec["source_id"])

            if args.dry_run and len(samples) < args.show_first:
                samples.append(rec)

            batch.append(rec)
            if len(batch) >= args.batch:
                flush()

            if total_read % PROGRESS_EVERY == 0:
                elapsed = time.time() - start
                rate = total_read / elapsed if elapsed > 0 else 0.0
                print(
                    f"  [{total_read:>7d}] 已读 / 已插 {total_inserted:>7d}"
                    f" / 跳过 {total_skip:>5d} / 重复 {total_dup:>6d}"
                    f" / 失败 {total_failed:>4d}  ({rate:.0f} 行/秒)"
                )

    # 收尾最后一批
    flush()

    elapsed = time.time() - start
    print()
    print("=" * 60)
    print(f"读取总行数      : {total_read}")
    print(f"成功插入        : {total_inserted}")
    print(f"跳过(无效/CSV重) : {total_skip}")
    print(f"已存在跳过      : {total_dup}")
    print(f"失败            : {total_failed}")
    print(f"耗时            : {elapsed:.1f} 秒")
    print("=" * 60)

    if args.dry_run and samples:
        print("\n--- 转换样例 ---")
        for s in samples:
            print(json.dumps(s, ensure_ascii=False, indent=2))

    return 0 if total_failed == 0 else 2


if __name__ == "__main__":
    sys.exit(main())
