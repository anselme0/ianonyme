#!/bin/bash
cd "$(dirname "$0")"
export PYTHONIOENCODING=utf-8
python harness.py qwen2.5:1.5b t5
T5_CPU=1 python harness.py ministral-3:3b t5
T5_CPU=1 python harness.py qwen3.5:4b t5
for m in gemma3:4b phi4-mini ministral-3:8b; do
  cpu=1; [ "$m" = "ministral-3:8b" ] && cpu=0
  python harness.py $m t1 t4 t6
  T5_CPU=$cpu python harness.py $m t5
  ollama stop $m; ollama rm $m && echo "removed $m"
done
echo ALL_DONE
