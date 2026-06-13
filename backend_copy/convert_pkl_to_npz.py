"""
Convert 10min_1hr_all_data.pkl → 10min_1hr_all_data.npz

The pickle stores torch.Tensor arrays. The npz stores plain float32 numpy arrays,
which load ~5-10x faster and avoid importing torch during deserialization.

Usage:
    python backend_copy/convert_pkl_to_npz.py
    python backend_copy/convert_pkl_to_npz.py /path/to/custom.pkl /path/to/output.npz
"""
from __future__ import annotations

import argparse
import pickle
import sys
import time
from pathlib import Path

import numpy as np

_DEFAULT_SOURCES = [
    Path("/public/gormpo/10min_1hr_all_data.pkl"),
    Path(__file__).resolve().parent / "10min_1hr_all_data.pkl",
]


def convert(src: Path, dst: Path) -> None:
    print(f"Reading  {src}  ({src.stat().st_size / 1e6:.1f} MB) …")
    t0 = time.perf_counter()
    with open(src, "rb") as f:
        data = pickle.load(f)
    t1 = time.perf_counter()
    print(f"  pickle.load done in {t1 - t0:.2f}s")

    def to_f32(v) -> np.ndarray:
        if hasattr(v, "numpy"):          # torch.Tensor
            return v.numpy().astype(np.float32)
        return np.asarray(v, dtype=np.float32)

    arrays = {k: to_f32(v) for k, v in data.items()}

    dst.parent.mkdir(parents=True, exist_ok=True)
    print(f"Writing  {dst} …")
    t2 = time.perf_counter()
    np.savez(dst, **arrays)
    t3 = time.perf_counter()
    print(f"  np.savez done in {t3 - t2:.2f}s")
    print(f"  Output size: {dst.stat().st_size / 1e6:.1f} MB")

    # Quick sanity check
    loaded = np.load(dst)
    for key in arrays:
        assert loaded[key].shape == arrays[key].shape, f"Shape mismatch for {key}"
    print(f"  Sanity check passed. Keys: {list(loaded.keys())}")
    print(f"Done. Total time: {t3 - t0:.2f}s")


def main() -> None:
    parser = argparse.ArgumentParser(description="Convert .pkl data to .npz")
    parser.add_argument("src", nargs="?", help="Source .pkl path")
    parser.add_argument("dst", nargs="?", help="Destination .npz path")
    args = parser.parse_args()

    if args.src:
        src = Path(args.src)
    else:
        src = next((p for p in _DEFAULT_SOURCES if p.is_file()), None)
        if src is None:
            print("ERROR: no pickle found. Pass explicit path or place pickle at:")
            for p in _DEFAULT_SOURCES:
                print(f"  {p}")
            sys.exit(1)

    dst = Path(args.dst) if args.dst else src.with_suffix(".npz")
    convert(src, dst)


if __name__ == "__main__":
    main()
