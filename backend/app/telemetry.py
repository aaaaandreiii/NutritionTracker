from __future__ import annotations

import json
import logging
import os
from typing import Any


logger = logging.getLogger("sugar_pai.telemetry")


def emit_telemetry(event: str, **fields: Any) -> None:
    payload = {
        "event": event,
        **{key: value for key, value in fields.items() if value is not None},
    }
    logger.info(json.dumps(payload, sort_keys=True, separators=(",", ":")))
    _mirror_to_mlflow(event, payload)


def _mirror_to_mlflow(event: str, payload: dict[str, Any]) -> None:
    if not os.getenv("MLFLOW_TRACKING_URI"):
        return
    try:
        import mlflow
    except ImportError:
        logger.warning("MLflow tracking URI configured but mlflow is not installed.")
        return

    try:
        with mlflow.start_run(run_name=event, nested=True):
            for key, value in payload.items():
                if key == "event":
                    continue
                if isinstance(value, (int, float)) and not isinstance(value, bool):
                    mlflow.log_metric(key, value)
                elif isinstance(value, (str, bool)):
                    mlflow.log_param(key, str(value)[:250])
    except Exception as exc:  # pragma: no cover - telemetry must not break scans.
        logger.warning("MLflow telemetry mirror failed: %s", exc)
