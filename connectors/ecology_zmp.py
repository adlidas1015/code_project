"""Connector for 국립생태원 생태자연도 서비스 (data.go.kr B553084).

Endpoint: https://apis.data.go.kr/B553084/ecoapi/EcologyzmpService
"""

from __future__ import annotations

import os
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from typing import Any, Mapping
from urllib.parse import quote

import requests

BASE_URL = "https://apis.data.go.kr/B553084/ecoapi/EcologyzmpService"


@dataclass
class EcologyZmpConfig:
    service_key: str
    base_url: str = BASE_URL
    timeout: float = 30.0

    @classmethod
    def from_env(cls) -> "EcologyZmpConfig":
        key = os.environ.get("ECOLOGY_ZMP_SERVICE_KEY")
        if not key:
            raise RuntimeError(
                "ECOLOGY_ZMP_SERVICE_KEY env var is required. "
                "Use the Decoding key from data.go.kr."
            )
        return cls(service_key=key)


class EcologyZmpConnector:
    """Thin REST client for the Ecology Natural Map service.

    The service key from data.go.kr comes in two forms: Encoding (already
    percent-encoded) and Decoding (raw). Pass the Decoding key — this client
    percent-encodes it exactly once to avoid the common double-encoding bug.
    """

    def __init__(self, config: EcologyZmpConfig | None = None) -> None:
        self.config = config or EcologyZmpConfig.from_env()
        self.session = requests.Session()

    def call(
        self,
        operation: str,
        params: Mapping[str, Any] | None = None,
        response_type: str = "json",
    ) -> Any:
        """Invoke an operation and return parsed JSON (dict) or XML (Element).

        Args:
            operation: e.g. "getEcologyzmp".
            params: operation-specific query params (pageNo, numOfRows, ...).
            response_type: "json" or "xml".
        """
        if response_type not in {"json", "xml"}:
            raise ValueError("response_type must be 'json' or 'xml'")

        # requests would re-encode the already-raw key; build the URL ourselves
        # so the key is encoded exactly once.
        encoded_key = quote(self.config.service_key, safe="")
        url = f"{self.config.base_url}/{operation}?serviceKey={encoded_key}"

        query: dict[str, Any] = {"type": response_type}
        if params:
            query.update(params)

        response = self.session.get(url, params=query, timeout=self.config.timeout)
        response.raise_for_status()

        if response_type == "json":
            return response.json()
        return ET.fromstring(response.text)

    def close(self) -> None:
        self.session.close()

    def __enter__(self) -> "EcologyZmpConnector":
        return self

    def __exit__(self, *_exc: object) -> None:
        self.close()
