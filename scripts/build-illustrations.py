# 女性イラストの下ごしらえ（パソコンで 1 回動かす）：
#   python3 scripts/build-illustrations.py
#
# 1. 「女性イラスト」フォルダの絵の、周りの余白を切り落として小さくしたコピーを private/illustrations/ に作る
#    （スライドを作るたびに送る量を減らすため。元の絵はそのまま）
# 2. 各絵に「どんな場面か」の印を AI で付けて、private/illustrations.json に書く
#    （AI が毎月のページの内容に合う絵を選ぶときに使う）
# 2 回目からは、印を付け終わった絵は AI に送らない。新しく絵を足したら、もう一度動かせばよい。

import base64
import io
import json
import os
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "女性イラスト"
OUT_DIR = ROOT / "private" / "illustrations"
OUT_JSON = ROOT / "private" / "illustrations.json"
MAX_SIDE = 700
BATCH = 6
MODEL = "claude-opus-5-5"

# 印の種類（AI が選ぶときもこの言葉で探す）
TAGS = [
    "悩む・不調", "疲れ・眠い", "眠る・休息", "リラックス", "食事", "料理", "飲み物・お茶",
    "運動・ストレッチ", "外出・散歩", "肌・スキンケア", "入浴", "笑顔・元気", "考える・問いかけ",
    "説明する・ポイント", "仕事・勉強", "花・植物", "人物なし",
]
SEASONS = ["春", "夏", "秋", "冬", "どの季節でも"]


def load_env():
    env = ROOT / ".env.local"
    if env.exists():
        for line in env.read_text(encoding="utf8").splitlines():
            if "=" in line and not line.strip().startswith("#"):
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())


def trim_and_resize(src: Path) -> Image.Image:
    im = Image.open(src).convert("RGBA")
    alpha = im.getchannel("A").point(lambda a: 255 if a > 10 else 0)
    box = alpha.getbbox()
    if box is None or box == (0, 0, im.width, im.height):
        # 背景が白で塗られている絵は、白くない所で切る
        rgb = im.convert("RGB").point(lambda c: 255 if c < 245 else 0).convert("L")
        box = rgb.getbbox() or (0, 0, im.width, im.height)
    pad = int(max(im.width, im.height) * 0.02)
    box = (max(box[0] - pad, 0), max(box[1] - pad, 0), min(box[2] + pad, im.width), min(box[3] + pad, im.height))
    im = im.crop(box)
    im.thumbnail((MAX_SIDE, MAX_SIDE))
    return im


def tag_batch(client, batch):
    content = []
    for i, (name, im) in enumerate(batch):
        small = im.copy()
        small.thumbnail((400, 400))
        bg = Image.new("RGB", small.size, "white")
        bg.paste(small, mask=small.getchannel("A"))
        buf = io.BytesIO()
        bg.save(buf, "JPEG", quality=80)
        content.append({"type": "text", "text": f"絵 {i + 1}（id: {name}）"})
        content.append({"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": base64.b64encode(buf.getvalue()).decode()}})
    content.append({"type": "text", "text": (
        "シェア会のスライドに添える女性イラストです。それぞれの絵について、id、どんな場面かの短い説明（20文字くらい）、"
        f"当てはまる印（次の中から1〜3個：{'、'.join(TAGS)}）、合う季節（{'、'.join(SEASONS)} から1つ）を返してください。"
    )})
    schema = {
        "type": "object",
        "properties": {
            "items": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "id": {"type": "string"},
                        "desc": {"type": "string"},
                        "tags": {"type": "array", "items": {"type": "string", "enum": TAGS}},
                        "season": {"type": "string", "enum": SEASONS},
                    },
                    "required": ["id", "desc", "tags", "season"],
                    "additionalProperties": False,
                },
            }
        },
        "required": ["items"],
        "additionalProperties": False,
    }
    res = client.messages.create(
        model=MODEL,
        max_tokens=4000,
        output_config={"effort": "low", "format": {"type": "json_schema", "schema": schema}},
        messages=[{"role": "user", "content": content}],
    )
    if res.stop_reason == "refusal":
        raise RuntimeError("AI が印付けを断りました")
    text = "".join(b.text for b in res.content if b.type == "text")
    return json.loads(text)["items"]


def main():
    load_env()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    known = {}
    if OUT_JSON.exists():
        known = {x["id"]: x for x in json.loads(OUT_JSON.read_text(encoding="utf8"))}

    files = sorted(p for p in SRC.iterdir() if p.suffix.lower() == ".png" and " (1)" not in p.stem)
    todo = []
    result = []
    for p in files:
        im = trim_and_resize(p)
        im.save(OUT_DIR / f"{p.stem}.png", optimize=True)
        entry = {"id": p.stem, "ratio": round(im.width / im.height, 4)}
        if p.stem in known and known[p.stem].get("desc"):
            entry.update({k: known[p.stem][k] for k in ("desc", "tags", "season")})
        else:
            todo.append((p.stem, im))
        result.append(entry)
    print(f"小さくしたコピー：{len(files)} 枚（private/illustrations/）")

    if todo:
        if not os.environ.get("ANTHROPIC_API_KEY"):
            sys.exit("ANTHROPIC_API_KEY が無いので、印を付けられません。")
        import anthropic

        client = anthropic.Anthropic()
        tagged = {}
        for i in range(0, len(todo), BATCH):
            batch = todo[i : i + BATCH]
            for item in tag_batch(client, batch):
                tagged[item["id"]] = item
            print(f"  印を付けました：{min(i + BATCH, len(todo))}/{len(todo)}")
        for entry in result:
            t = tagged.get(entry["id"])
            if t:
                entry.update({"desc": t["desc"], "tags": t["tags"], "season": t["season"]})

    missing = [e["id"] for e in result if "desc" not in e]
    OUT_JSON.write_text(json.dumps(result, ensure_ascii=False, indent=1), encoding="utf8")
    print(f"private/illustrations.json を作りました（{len(result)} 枚、印なし {len(missing)} 枚）")
    if missing:
        print("  印が付かなかった絵：", ", ".join(missing))


if __name__ == "__main__":
    main()
