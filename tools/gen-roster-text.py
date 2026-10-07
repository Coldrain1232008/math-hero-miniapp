#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
生成「批量导入学生」用的文本（用于大会体验班等场景）。

输出格式与 cloudfunctions/importStudents 的 parseStudentLine 严格对齐：

    学号 姓名 个人密钥

    例：0001 来宾0001 0001

解析规则（见 importStudents/index.js L30-55）：
  - 按 逗号 / 中文逗号 / Tab / 空格 切分
  - 第一段必须是纯数字（^\\d+$），否则整行会被当成「只有姓名」
  - 第二段 = 真实姓名，第三段 = 个人密钥

⚠️ 文本里不要写分隔行（如 "===== 第 1 批 ====="）：
   分隔行第一段不是纯数字，会被当成一个叫 "=====" 的学生导进去。

用法：
    python3 tools/gen-roster-text.py
    python3 tools/gen-roster-text.py --start 1 --end 500 --prefix 来宾
"""
import argparse
import os
import sys

AP = argparse.ArgumentParser()
AP.add_argument('--start', type=int, default=1, help='起始座位号（含）')
AP.add_argument('--end', type=int, default=1000, help='结束座位号（含）')
AP.add_argument('--digits', type=int, default=4, help='学号位数，默认 4 位')
AP.add_argument('--prefix', default='来宾', help='姓名前缀')
AP.add_argument('--batch', type=int, default=100,
                help='分批文件的每批人数。1000 人一次导入会超时，默认拆成 100/批')
AP.add_argument('--out', default=os.path.expanduser('~/Desktop/大会体验班-导入文本'),
                help='输出目录')
ARGS = AP.parse_args()

if ARGS.end < ARGS.start:
    sys.exit('end 必须 >= start')

os.makedirs(ARGS.out, exist_ok=True)


def line_of(n: int) -> str:
    """座位号 n -> 一行导入文本。学号 = 个人密钥 = 补零后的座位号。"""
    seat = str(n).zfill(ARGS.digits)
    return f'{seat} {ARGS.prefix}{seat} {seat}\n'


nums = list(range(ARGS.start, ARGS.end + 1))
written = []

# 1) 全量文件
full_name = f'全部{len(nums)}人.txt'
with open(os.path.join(ARGS.out, full_name), 'w', encoding='utf-8') as f:
    for n in nums:
        f.write(line_of(n))
written.append((full_name, len(nums)))

# 2) 分批文件（每批 ARGS.batch 人）——规避云函数调用超时
n_batches = (len(nums) + ARGS.batch - 1) // ARGS.batch
width = len(str(n_batches))
for i in range(n_batches):
    chunk = nums[i * ARGS.batch:(i + 1) * ARGS.batch]
    lo = str(chunk[0]).zfill(ARGS.digits)
    hi = str(chunk[-1]).zfill(ARGS.digits)
    name = f'批次{str(i + 1).zfill(width)}_{lo}-{hi}.txt'
    with open(os.path.join(ARGS.out, name), 'w', encoding='utf-8') as f:
        for n in chunk:
            f.write(line_of(n))
    written.append((name, len(chunk)))

print(f'输出目录：{ARGS.out}')
print()
for name, cnt in written:
    print(f'  {name:34s} {cnt:>5d} 行')
print()
print(f'合计 {len(nums)} 人，拆成 {n_batches} 批（每批 {ARGS.batch} 人）')
print()
print('样式预览（前 3 行）：')
for n in nums[:3]:
    print('  ' + line_of(n).rstrip())
