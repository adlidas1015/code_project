# DASAN DMC · ESG 15초 모션 그래픽

`https://www.dasandmc.com/kor/esg/esg.html`(다산디엠씨 ESG 경영)을 소개하는 15초 영상.

- 결과물: `out/dasandmc_esg_reel_15s.mp4` (1920×1080, 60fps, H.264 High / BT.709, AAC 320kbps, 15.000초)
- 음악: `out/music.wav` (48kHz/24bit, −13.6 LUFS, true-peak −1.3 dBTP 이하). 샘플 없이 직접 합성한 원곡이라 라이선스 이슈가 없음.
- 스토리보드: `out/storyboard.jpg`

## 구성 (128 BPM, 1마디 = 1.875초)

| 시간 | 음악 | 화면 | 출처 페이지 |
|---|---|---|---|
| 0.00–1.88 | 인트로 (벨 모티프) | 사이트 히어로 이미지 · "ESG 경영" · 슬로건 | esg.html, strategy.html |
| 1.88–3.75 | 빌드업 (스네어 롤, 라이저) | 실제 ESG 메뉴 페이지 3D. 스네어 8분음표마다 카드 4장이 차례로 떠오름 | esg.html |
| 3.75–5.63 | 드롭 임팩트 | 로고, ESG 전략 수치 4종 | strategy.html |
| 5.63–7.50 | 드롭 | 01 환경경영: 인용문, 수치 4종, 실제 페이지 | environment.html |
| 7.50–9.38 | 드롭 | 02 사회책임경영 | social.html |
| 9.38–11.25 | 드롭 | 03 투명경영 | governance.html |
| 11.25–13.13 | 상승부 | 04 대외 평가·인증 (EcoVadis, CDP, ISO 인증 5종) | strategy.html, library.html |
| 13.13–15.00 | 마무리 (F장조 해결) | 엔드카드: 로고, 슬로건, URL | esg.html |

- 모든 컷과 모션은 `out/cues.json`(킥·클랩·스네어·벨·와이프 시점)에 맞춰 배치.
- 하드컷 오차는 1프레임(16.7ms) 이내로 실측.
- 영상 속 문구·수치는 전부 사이트 원문 그대로 사용 (2026-09-29 수집).
  - 예외 1건: strategy.html의 "EcoVadis Committed 메달"은 영상에서 "Committed 배지"로 표기.
  - 이유: EcoVadis는 메달(Platinum/Gold/Silver/Bronze, 백분위 기준)과 Committed 배지(종합 45점 이상)를 구분함. library.html 원문도 "Committed"로만 표기.
- 코드·연도·등급(ISO 번호, 1973, 2026.05, B)은 애니메이션 중에도 틀린 값이 화면에 나오지 않게 처리. 카운트업은 실제 수량(492명, 58, 44, 10.14%, 0.46%)에만 적용.

## 재현 방법

```bash
node scripts/scrape.mjs          # 사이트 수집 → scene/assets/site/<page>/ (스크린샷, 이미지, page.json)
python3 scripts/vectorize_logo.py  # 사이트 로고(285×30 PNG)를 윤곽 추적해 SVG로 → scene/assets/brand/
python3 scripts/prep_assets.py     # 영상용 자산 → scene/assets/v/
python3 audio/compose.py           # 음악 + 비트 큐 → out/music.wav, out/cues.json, scene/cues.js
node scripts/render.mjs --fps 60 --sub 3 --workers 4 --out out/dasandmc_esg_reel_15s.mp4
```

- 필요 환경: Node 22 + Playwright(Chromium), Python 3.11 + numpy/scipy/numba/pyloudnorm/soundfile/potracer/Pillow, ffmpeg(`imageio-ffmpeg`).
- 크롬에서 음악과 함께 미리보기: 로컬 서버로 `scene/index.html`을 열고 ▶ 버튼 클릭 (예: `npx http-server esg-reel`).
- 렌더러 동작:
  - 타임라인을 정확한 시각으로 이동시켜 프레임을 캡처하므로 결과가 항상 동일함.
  - 한 프레임당 셔터 180° 구간을 여러 장으로 캡처해 평균을 내므로 실제 모션블러가 생김.

## 폴더

- `audio/compose.py`: 음악(킥/스네어/클랩/하이햇, 슈퍼소 패드, 플럭 아르페지오, FM 벨, 라이저, 임팩트)을 합성하고 믹싱·마스터링
- `scene/`: 영상 화면(HTML/CSS/GSAP). 원문 데이터는 `reel.js`의 `DATA`에 있음
- `scripts/`: 사이트 수집, 로고 벡터화, 자산 준비, 렌더러
- 폰트: Pretendard, JetBrains Mono (둘 다 SIL OFL 1.1, 라이선스 파일 동봉). 모션 라이브러리: GSAP (Standard "no charge" license)
