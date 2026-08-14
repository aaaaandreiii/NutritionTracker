import asyncio
import json

from fastapi.testclient import TestClient

from app.chat import SAFETY_RESPONSE
from app.chat_retrieval import _deduplicate, _domain_allowed, retrieve_evidence
from app.main import app
from app.schemas import ChatSource


def parse_events(body: str) -> list[dict]:
    return [json.loads(line.removeprefix("data: ")) for line in body.splitlines() if line.startswith("data: ")]


def product_context() -> dict:
    return {
        "localLogId": "log-1",
        "productName": "Validated oats",
        "brand": "Example",
        "market": "PH",
        "servingLabel": "30 g serving",
        "barcode": "4800000000000",
        "nutrients": {
            "totalCarbohydrate": 22,
            "fiber": 3,
            "totalSugars": 7,
            "addedSugars": None,
            "sugarAlcohols": None,
            "protein": 4,
            "fat": 2,
        },
        "ingredients": "Oats, sugar, salt",
        "sugarVariants": ["Sucrose"],
        "glycemicStatus": "heuristic_demo",
        "glycemicReason": "Local demo only.",
    }


def test_chat_stream_emits_sources_before_token_deltas_and_grounds_product(monkeypatch):
    async def fake_stream(messages):
        assert "Validated label: Validated oats" in messages[0]["content"]
        yield "The label declares "
        yield "7 g total sugars [1](#source-1)."

    monkeypatch.setattr("app.chat.stream_ollama", fake_stream)
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/chat/stream",
            json={"question": "What does this product label say about added sugars?", "turns": [], "product": product_context()},
        )

    assert response.status_code == 200
    events = parse_events(response.text)
    types = [event["type"] for event in events]
    assert types.index("sources") < types.index("delta")
    assert events[types.index("sources")]["sources"][0]["type"] == "product"
    assert "not declared / unavailable" in events[types.index("sources")]["sources"][0]["excerpt"]
    assert events[-1] == {"type": "done", "finishReason": "complete"}
    assert len([event for event in events if event["type"] == "delta"]) == 2


def test_chat_safety_refusal_does_not_call_model(monkeypatch):
    async def should_not_run(_messages):
        raise AssertionError("model should not be called")
        yield ""

    monkeypatch.setattr("app.chat.stream_ollama", should_not_run)
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/chat/stream",
            json={"question": "How much insulin should I take for this product?", "product": product_context()},
        )

    events = parse_events(response.text)
    assert events[-1]["finishReason"] == "safety_refusal"
    assert SAFETY_RESPONSE in "".join(event.get("text", "") for event in events)
    assert next(event for event in events if event["type"] == "sources")["sources"] == []


def test_chat_rejects_out_of_scope_request_without_uncited_model_knowledge(monkeypatch):
    async def should_not_run(_messages):
        raise AssertionError("model should not be called")
        yield ""

    monkeypatch.setattr("app.chat.stream_ollama", should_not_run)
    with TestClient(app) as client:
        response = client.post("/api/v1/chat/stream", json={"question": "Who won the football match yesterday?"})

    events = parse_events(response.text)
    assert events[-1]["finishReason"] == "out_of_scope"
    assert "curated scope" in "".join(event.get("text", "") for event in events)


def test_chat_request_limits_prior_turns_and_question_length():
    turns = [{"role": "user", "content": f"turn {index}"} for index in range(11)]
    with TestClient(app) as client:
        too_many = client.post("/api/v1/chat/stream", json={"question": "What are added sugars?", "turns": turns})
        too_long = client.post("/api/v1/chat/stream", json={"question": "s" * 2001})

    assert too_many.status_code == 422
    assert too_long.status_code == 422


def test_authoritative_domain_filter_blocks_lookalikes():
    assert _domain_allowed("https://www.fda.gov/food/example")
    assert _domain_allowed("https://pmc.ncbi.nlm.nih.gov/articles/example")
    assert not _domain_allowed("https://fda.gov.example.com/food/example")
    assert not _domain_allowed("https://example.com/article")


def test_source_deduplication_preserves_order_and_reindexes():
    first = ChatSource(
        id="one", index=1, type="curated", relationship="supporting", strength="strong",
        title="First", publisher="FDA", domain="fda.gov", url="https://fda.gov/a", excerpt="One",
    )
    duplicate = first.model_copy(update={"id": "duplicate", "index": 5})
    second = first.model_copy(update={"id": "two", "title": "Second", "url": "https://who.int/b", "index": 6})

    result = _deduplicate([first, duplicate, second])
    assert [source.id for source in result] == ["one", "two"]
    assert [source.index for source in result] == [1, 2]


def test_no_evidence_state_does_not_call_model(monkeypatch):
    async def no_sources(_question, _product):
        return [], []

    async def should_not_run(_messages):
        raise AssertionError("model should not be called")
        yield ""

    monkeypatch.setattr("app.chat.retrieve_evidence", no_sources)
    monkeypatch.setattr("app.chat.stream_ollama", should_not_run)
    with TestClient(app) as client:
        response = client.post("/api/v1/chat/stream", json={"question": "What are added sugars?"})

    events = parse_events(response.text)
    assert events[-1]["finishReason"] == "no_evidence"
    assert next(event for event in events if event["type"] == "sources")["sources"] == []


def test_model_timeout_is_retryable_and_keeps_sources_stable(monkeypatch):
    async def slow_stream(_messages):
        await asyncio.sleep(0.05)
        yield "late"

    monkeypatch.setattr("app.chat.stream_ollama", slow_stream)
    monkeypatch.setenv("SUGAR_PAI_CHAT_TIMEOUT_SECONDS", "0.001")
    with TestClient(app) as client:
        response = client.post("/api/v1/chat/stream", json={"question": "What are added sugars?"})

    events = parse_events(response.text)
    assert any(event["type"] == "sources" for event in events)
    assert events[-1]["type"] == "error"
    assert events[-1]["code"] == "model_timeout"
    assert events[-1]["retryable"] is True


def test_search_failure_returns_curated_fallback_warning(monkeypatch):
    async def failed_search(_question):
        return [], "Live search was unavailable; the answer uses curated evidence only."

    monkeypatch.setattr("app.chat_retrieval._tavily_sources", failed_search)
    sources, warnings = asyncio.run(retrieve_evidence("What does NOVA mean?", None))

    assert any(source.id == "off-data-source" for source in sources)
    assert warnings == ["Live search was unavailable; the answer uses curated evidence only."]
