# Base 모델 파일 필요 여부 분석

## 커스텀 체크포인트 모델 사용 시

### ✅ 필수 파일 (반드시 필요)

1. **Text Encoders & Tokenizers**
   - `text_encoder/` 폴더 (구조 + 가중치)
   - `text_encoder_2/` 폴더 (구조 + 가중치)
   - `tokenizer/` 폴더
   - `tokenizer_2/` 폴더
   - **이유**: 커스텀 체크포인트는 UNet만 포함하므로 Text Encoder는 base 모델에서 재사용

2. **VAE**
   - `vae/` 폴더 (구조 + 가중치)
   - **이유**: VAE는 base 모델과 동일하게 재사용

3. **UNet 구조**
   - `unet/` 폴더 (구조만, 가중치는 체크포인트에서 로드)
   - **이유**: UNet 구조를 초기화하기 위해 필요 (가중치는 체크포인트 파일에서 로드)

4. **Scheduler**
   - `scheduler/` 폴더
   - **이유**: 샘플링 스케줄러 설정

5. **기타 설정 파일**
   - `model_index.json` (모델 구조 정의)
   - `config.json` (전역 설정)

### ❌ 불필요한 파일 (커스텀 체크포인트 사용 시)

1. **`sd_xl_base_1.0.safetensors`**
   - **이유**: UNet 가중치는 커스텀 체크포인트 파일에서 로드하므로 불필요
   - **예외**: 기본 모델(`sdxl_base`)을 사용할 때는 필요

2. **`sdxl.vae.safetensors`** (선택)
   - **이유**: `vae/` 폴더가 있으면 불필요
   - **예외**: VAE 가중치를 별도 파일에서 로드하려면 필요 (현재 코드는 `vae/` 폴더 우선)

### ⚠️ 선택적 파일

1. **`sd_xl_refiner_1.0.safetensors`**
   - **이유**: Refiner 사용 시 필요
   - **현재 상태**: 파일에 UNet 키가 없어 기본 가중치 사용 중

## 기본 모델(`sdxl_base`) 사용 시

### ✅ 필수 파일

- 모든 base 모델 컴포넌트 (text_encoder, vae, unet, scheduler 등)
- `sd_xl_base_1.0.safetensors` (UNet 가중치)
- `sdxl.vae.safetensors` (VAE 가중치, 선택)

## 요약

**커스텀 체크포인트 모델만 사용한다면:**
- ✅ `text_encoder/`, `text_encoder_2/`, `tokenizer/`, `tokenizer_2/` (필수)
- ✅ `vae/` (필수)
- ✅ `unet/` (구조만, 필수)
- ✅ `scheduler/` (필수)
- ❌ `sd_xl_base_1.0.safetensors` (불필요, 약 6.6GB 절약 가능)
- ❌ `sdxl.vae.safetensors` (불필요, `vae/` 폴더가 있으면)

**디스크 공간 절약:**
- `sd_xl_base_1.0.safetensors` 삭제 시 약 **6.6GB** 절약 가능
- `sdxl.vae.safetensors` 삭제 시 약 **335MB** 절약 가능 (vae/ 폴더가 있으면)

