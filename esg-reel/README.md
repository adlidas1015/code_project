# DASAN DMC · ESG 모션 그래픽

`https://www.dasandmc.com/kor/esg/esg.html`(다산디엠씨 ESG 경영)의 내용을 소개하는 영상 2종.

| 버전 | 파일 | 방식 |
|---|---|---|
| **v2 · 30초 (최신)** | `out/dasandmc_esg_film_30s.mp4`(마스터 46MB), `out/dasandmc_esg_film_30s_share.mp4`(공유용 25MB), `out/storyboard30.jpg` | 웹페이지 캡처 없이 ESG 내용만 가져와 그래픽을 직접 설계 |
| v1 · 15초 | `out/dasandmc_esg_reel_15s.mp4`, `out/storyboard.jpg` | 실제 페이지 캡처를 3D 목업으로 활용 |

- 공통 사양: 1920×1080, 60fps, H.264 High / BT.709, AAC 320kbps
- 음악: 샘플 없이 직접 합성한 원곡이라 라이선스 이슈가 없음. −13.6 LUFS, true-peak −1 dBTP 이하.

## v2 · 30초 구성 (128 BPM, 16마디 = 30.000초)

| 시간 | 음악 | 장면 | 비주얼 | 출처 |
|---|---|---|---|---|
| 0.0–3.75 | 인트로 | 슬로건 | 파티클 지형 + "지속가능한 모빌리티, 다산디엠씨가 만드는 내일" | strategy |
| 3.75–7.5 | 빌드업 | ESG 전략 수치 | 1973: 연도 눈금자 / 492명: 도트 492개 / 8: 거점 네트워크 / 5종: 인증 링 | strategy |
| 7.5–9.4 | 드롭 | 로고 → E·S·G | 로고 임팩트 → 기둥 3개 → E 패널이 화면 전체로 확장 | esg |
| 9.4–13.1 | 그루브 | 환경경영 | 6대 핵심 영역 아이콘 링 → 2030 감축 목표 10.14%(2019 대비) 막대, ISO 14001, 환경 KPI 33종 | environment, strategy |
| 13.1–16.9 | 그루브 | 사회책임경영 | 중대재해 0 링 → 위험 통제계층 5단계, ISO 45001·7대 고위험작업 허가제·인권헌장 11대 선언 | social |
| 16.9–20.6 | 그루브 | 투명경영 | ISO 37001·37301 통합 인증 씰(2026.05, 영천1공장) → 윤리경영 6대 지향 | governance |
| 20.6–24.4 | 브레이크다운 | 대외 평가·인증 | EcoVadis 종합 53 게이지, CDP 등급 스케일(전년 D → 2025 B), 인증 5종 | strategy, library |
| 24.4–28.1 | 파이널 드롭 | ESG 목표·핵심 KPI | 비트마다 풀스크린 카드 8장 (0건, 100%, 75개, Scope 1+2) | strategy, environment |
| 28.1–30.0 | 엔딩 | 엔드카드 | 로고, 슬로건, URL | esg |

## 콘텐츠 원칙 (v1·v2 공통)

- 문구·수치는 사이트 원문 그대로 사용 (2026-09-29 수집).
- 예외 1건: "EcoVadis Committed 메달"은 "Committed 배지"로 표기.
  - 이유: EcoVadis는 메달(Platinum/Gold/Silver/Bronze, 백분위 기준)과 Committed 배지(종합 45점 이상)를 구분함. library.html 원문도 "Committed"로만 표기.
- v2 KPI 카드 8장은 strategy.html "ESG 목표·핵심 KPI"와 environment.html 방침에 적힌 **목표**임. 카드 상단에 "ESG 목표 · 핵심 KPI"로 표시함.
- 코드·연도·등급(ISO 번호, 1973, 2026.05, B)은 애니메이션 중에도 틀린 값이 화면에 나오지 않게 처리. 카운트업은 실제 수량에만 적용.
- 음악 큐(킥·클랩·스네어·벨·임팩트, `out/cues*.json`)에 맞춰 컷과 모션을 배치.

## 재현 방법

```bash
node scripts/scrape.mjs              # 사이트 수집 → scene/assets/site/<page>/
python3 scripts/vectorize_logo.py    # 285×30 로고 PNG → SVG
python3 scripts/prep_assets.py       # 영상용 자산 → scene/assets/v/
# v2 (30초)
python3 audio/compose30.py           # → out/music30.wav, out/cues30.json, scene30/cues.js
node scripts/render.mjs --scene scene30 --audio out/music30.wav --to 30 --sub 3 --out out/dasandmc_esg_film_30s.mp4
# v1 (15초)
python3 audio/compose.py             # → out/music.wav, out/cues.json, scene/cues.js
node scripts/render.mjs --sub 3 --out out/dasandmc_esg_reel_15s.mp4
```

- 필요 환경: Node 22 + Playwright(Chromium), Python 3.11 + numpy/scipy/numba/pyloudnorm/soundfile/potracer/Pillow, ffmpeg(`imageio-ffmpeg`).
- 미리보기: 로컬 서버로 `scene30/index.html`을 열고 ▶ 버튼 클릭 (예: `npx http-server esg-reel`).
- 렌더러 동작:
  - 타임라인을 정확한 시각으로 이동시켜 프레임을 캡처하므로 결과가 항상 동일함.
  - 한 프레임당 셔터 180° 구간을 3장씩 캡처해 평균 → 실제 모션블러.

## 폴더

- `audio/synth.py`: 신스·드럼·이펙트·믹싱 공용 엔진
- `audio/compose30.py`: v2 편곡
- `audio/compose.py`: v1 편곡
- `scene30/`: v2 화면. 파티클 지형·도트 매트릭스는 Canvas, 게이지·차트·씰·다이어그램은 SVG, 타이포는 DOM
- `scene/`: v1 화면
- `scripts/`: 사이트 수집, 로고 벡터화, 자산 준비, 렌더러
- 라이선스:
  - 폰트: Pretendard, JetBrains Mono (SIL OFL 1.1)
  - 아이콘: Lucide (ISC)
  - 모션 라이브러리: GSAP (Standard "no charge" license)
