# 데이터셋 형식 분석 및 변환 가이드

## 현재 상황

### ✅ 올바른 형식 (바로 사용 가능)

1. **`training_categori.jsonl`** (10,001줄)
   - 형식: `{"messages": [{"role": "system", "content": "..."}, {"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}]}`
   - **✅ 바로 사용 가능**

### ❌ 변환 필요 (instruction/input/output 형식)

2. **`emotion_multi_llama_format.jsonl`** (30,307줄)
   - 형식: `{"instruction": "...", "input": "...", "output": "..."}`
   - 변환 필요: instruction → system, input → user, output → assistant

3. **`bigfive_multi_llama_format.jsonl`** (10,001줄)
   - 형식: `{"instruction": "...", "input": "...", "output": "..."}`
   - 변환 필요: instruction → system, input → user, output → assistant

4. **`mbti_multi_llama_format.jsonl`** (75,598줄)
   - 형식: `{"instruction": "...", "input": "...", "output": "..."}`
   - 변환 필요: instruction → system, input → user, output → assistant

### ❌ 변환 필요 (preprocces 폴더)

5. **`preprocces/diary_copers.csv`**
   - CSV 형식: `id,text,emotion`
   - 변환 필요: CSV → JSONL messages 형식

6. **`preprocces/mbti_corpus_*.json`** (4개 파일)
   - JSON 배열 형식: `[{"id": ..., "localdate": ..., "title": ..., "content": ..., "userid": ..., "E_I": 1/2}, ...]`
   - 변환 필요: JSON 배열 → JSONL messages 형식

## train_multitask_qlora.py가 기대하는 형식

```json
{"messages": [
  {"role": "system", "content": "태스크 설명..."},
  {"role": "user", "content": "사용자 입력..."},
  {"role": "assistant", "content": "모델 출력..."}
]}
```

## 문제점

1. **파일명 불일치**: `train_multitask_qlora.py`의 `TRAINING_DATA_FILES`가 존재하지 않는 파일명을 참조
   - `training_data_10000_improved.jsonl` → 실제: `training_categori.jsonl`
   - `training_data_emotion.jsonl` → 실제: `emotion_multi_llama_format.jsonl` (변환 필요)
   - `training_data_mbti.jsonl` → 실제: `mbti_multi_llama_format.jsonl` (변환 필요)
   - `training_data_big5.jsonl` → 실제: `bigfive_multi_llama_format.jsonl` (변환 필요)

2. **형식 불일치**: 대부분의 파일이 `instruction/input/output` 형식

## 해결 방법

변환 스크립트를 작성하여 모든 데이터를 올바른 형식으로 변환하세요.

