"""Minimal example: fetch a page of Ecology Natural Map records."""

from connectors import EcologyZmpConnector


def main() -> None:
    with EcologyZmpConnector() as client:
        result = client.call(
            "getEcologyzmp",
            params={"pageNo": 1, "numOfRows": 10},
            response_type="json",
        )
        print(result)


if __name__ == "__main__":
    main()
