# code_project

## 국립생태원 생태자연도 커넥터

data.go.kr B553084 `EcologyzmpService` REST API 커넥터.

- Endpoint: `https://apis.data.go.kr/B553084/ecoapi/EcologyzmpService`
- 포맷: JSON / XML

### 사용법

```bash
pip install -r requirements.txt
cp .env.example .env   # Decoding 인증키를 붙여넣기
export $(cat .env | xargs)
python -m examples.fetch_ecology_zmp
```

```python
from connectors import EcologyZmpConnector

with EcologyZmpConnector() as client:
    data = client.call(
        "getEcologyzmp",
        params={"pageNo": 1, "numOfRows": 10},
        response_type="json",
    )
```

인증키는 포털의 **Decoding** 값을 그대로 넣으세요. 커넥터가 URL 인코딩을
한 번만 적용해 이중 인코딩 문제를 방지합니다.
