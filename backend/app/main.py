from __future__ import annotations

import asyncio
import json
import shutil
import tempfile
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Annotated, AsyncIterator, Literal

from fastapi import FastAPI, File, Form, HTTPException, Response, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from .db.off_products import LOCAL_OFF_SOURCE_NAME, lookup_local_off_product, lookup_response
from .glycemic import build_glycemic_evidence
from .pipeline import (
    JOB_TTL_SECONDS,
    MAX_UPLOAD_BYTES,
    AnalysisJob,
    build_analysis_diagnostics,
    clone_result,
    inspect_and_sanitize_image,
    result_from_database,
    run_pipeline,
    user_value,
)
from .schemas import (
    AnalysisResult,
    BarcodeAnalysisRequest,
    CreateBarcodeAnalysisResponse,
    CreateAnalysisResponse,
    CuratedFoodRecord,
    FinalizeRequest,
    LabelRecordValidationResponse,
    NutrientFields,
    OffProductLookupResponse,
    ProductIdentity,
    Provenance,
    ServingInformation,
    UnlabeledFoodCatalogResponse,
    UnlabeledFoodIdentifyResponse,
    UnlabeledFoodRecordRequest,
)
from .taxonomy import SUGAR_TAXONOMY_VERSION, classify_ingredients
from .unlabeled_foods import (
    UnknownFoodError,
    UnknownPortionError,
    UnsupportedMarketError,
    catalog_response,
    identify_candidates_from_filename,
    validate_unlabeled_food_record,
)
from .validation import validate_nutrients


JOBS: dict[str, AnalysisJob] = {}


async def cleanup_expired_jobs() -> None:
    while True:
        await asyncio.sleep(60)
        cutoff = datetime.now(timezone.utc).timestamp() - JOB_TTL_SECONDS
        expired = [job_id for job_id, job in JOBS.items() if job.created_at.timestamp() < cutoff]
        for job_id in expired:
            delete_job_files(JOBS.pop(job_id))


@asynccontextmanager
async def lifespan(_app: FastAPI):
    task = asyncio.create_task(cleanup_expired_jobs())
    yield
    task.cancel()
    for job in JOBS.values():
        delete_job_files(job)
    JOBS.clear()


app = FastAPI(
    title="Sugar pAI Research API",
    version="0.1.0",
    description="Short-lived, evidence-preserving packaged-food label analysis.",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Content-Type"],
)


def delete_job_files(job: AnalysisJob) -> None:
    if job.temp_dir.exists():
        shutil.rmtree(job.temp_dir, ignore_errors=True)


async def read_upload(upload: UploadFile) -> bytes:
    data = await upload.read(MAX_UPLOAD_BYTES + 1)
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Each image must be 8 MB or smaller.")
    return data


async def save_upload(upload: UploadFile, kind: str, temp_dir: Path) -> tuple[Path, list]:
    data = await read_upload(upload)
    target = temp_dir / f"{kind}.jpg"
    try:
        checks = await asyncio.to_thread(
            inspect_and_sanitize_image,
            data,
            upload.content_type or "",
            target,
            kind,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return target, checks


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get(
    "/api/v1/off-products/{barcode}",
    response_model=OffProductLookupResponse,
    response_model_by_alias=True,
)
async def off_product_lookup(barcode: str, market: Literal["PH", "US"] = "PH") -> OffProductLookupResponse:
    normalized = "".join(character for character in barcode if character.isdigit())
    if normalized != barcode or not 6 <= len(normalized) <= 32:
        raise HTTPException(status_code=422, detail="Barcode must be 6 to 32 digits.")
    return await asyncio.to_thread(lookup_response, normalized, market)


@app.post(
    "/api/v1/analyses",
    response_model=CreateAnalysisResponse,
    response_model_by_alias=True,
    status_code=status.HTTP_202_ACCEPTED,
)
async def create_analysis(
    nutrition_image: Annotated[UploadFile, File(...)],
    market: Annotated[Literal["PH", "US"], Form(...)],
    ingredient_image: Annotated[UploadFile | None, File()] = None,
    front_image: Annotated[UploadFile | None, File()] = None,
    barcode: Annotated[str | None, Form(max_length=32, pattern=r"^[0-9]*$")] = None,
) -> CreateAnalysisResponse:
    analysis_id = str(uuid.uuid4())
    temp_dir = Path(tempfile.mkdtemp(prefix=f"sugar-pai-{analysis_id[:8]}-"))
    paths: dict[str, Path] = {}
    checks = []
    try:
        paths["nutrition"], nutrition_checks = await save_upload(nutrition_image, "nutrition", temp_dir)
        checks.extend(nutrition_checks)
        if ingredient_image:
            paths["ingredients"], ingredient_checks = await save_upload(ingredient_image, "ingredients", temp_dir)
            checks.extend(ingredient_checks)
        if front_image:
            paths["front"], front_checks = await save_upload(front_image, "front", temp_dir)
            checks.extend(front_checks)
    except Exception:
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise

    job = AnalysisJob(
        analysis_id=analysis_id,
        market=market,
        temp_dir=temp_dir,
        image_paths=paths,
        quality_checks=checks,
        barcode=barcode or None,
    )
    JOBS[analysis_id] = job
    asyncio.create_task(run_pipeline(job))
    return CreateAnalysisResponse(analysis_id=analysis_id)


@app.post(
    "/api/v1/analyses/barcode",
    response_model=CreateBarcodeAnalysisResponse,
    response_model_by_alias=True,
    status_code=status.HTTP_201_CREATED,
)
async def create_barcode_analysis(request: BarcodeAnalysisRequest) -> CreateBarcodeAnalysisResponse:
    lookup = await asyncio.to_thread(lookup_local_off_product, request.barcode, request.market)
    if lookup.status == "disabled":
        raise HTTPException(status_code=409, detail="Local Open Food Facts lookup is disabled.")
    if lookup.status == "db_missing":
        raise HTTPException(status_code=503, detail="Local Open Food Facts database is not available.")
    if lookup.status == "unsupported_market":
        raise HTTPException(status_code=422, detail="The local Open Food Facts database currently supports the Philippines market.")
    if lookup.status == "not_found" or not lookup.product:
        raise HTTPException(status_code=404, detail="Barcode was not found in the local Open Food Facts database.")
    if not lookup.complete:
        raise HTTPException(
            status_code=422,
            detail=f"Local Open Food Facts record is missing: {', '.join(lookup.missing_fields)}.",
        )

    analysis_id = str(uuid.uuid4())
    temp_dir = Path(tempfile.mkdtemp(prefix=f"sugar-pai-{analysis_id[:8]}-"))
    job = AnalysisJob(
        analysis_id=analysis_id,
        market=request.market,
        temp_dir=temp_dir,
        image_paths={},
        quality_checks=[],
        barcode=request.barcode,
    )
    diagnostics = build_analysis_diagnostics(job)
    result = result_from_database(job, lookup.product, lookup.source_url, [LOCAL_OFF_SOURCE_NAME], diagnostics)
    job.result = result
    JOBS[analysis_id] = job

    for event in [
        {"type": "stage", "stage": "image_check", "status": "skipped", "label": "No images required for complete database match"},
        {"type": "stage", "stage": "barcode_lookup", "status": "complete", "label": "Complete local database record found"},
        {"type": "stage", "stage": "label_extraction", "status": "skipped", "label": "Complete local database record used for review"},
        {"type": "stage", "stage": "ingredient_classification", "status": "complete" if result.raw_ingredients.value else "skipped", "label": "Database ingredient text classified" if result.raw_ingredients.value else "Database ingredient text unavailable"},
        {"type": "stage", "stage": "evidence_assembly", "status": "complete", "label": "Database fields assembled for manual review"},
        {"type": "stage", "stage": "safety_validation", "status": "complete", "label": "Deterministic copy only; unsupported health claims suppressed"},
        {"type": "result", "result": result.model_dump(mode="json", by_alias=True)},
    ]:
        await job.publish(event)
    job.done = True
    return CreateBarcodeAnalysisResponse(analysis_id=analysis_id, result=result)


def require_job(analysis_id: str) -> AnalysisJob:
    job = JOBS.get(analysis_id)
    if not job:
        raise HTTPException(status_code=404, detail="Analysis not found or already expired.")
    return job


def validate_label_record(request: FinalizeRequest) -> LabelRecordValidationResponse:
    validation_checks = validate_nutrients(request.nutrients)
    failed = next((check for check in validation_checks if check.status == "fail"), None)
    if failed:
        raise HTTPException(status_code=422, detail=failed.message)

    values = request.nutrients
    confirmed_nutrients = NutrientFields(
        total_carbohydrate=user_value(values.total_carbohydrate, unit="g"),
        fiber=user_value(values.fiber, unit="g"),
        total_sugars=user_value(values.total_sugars, unit="g"),
        added_sugars=user_value(values.added_sugars, unit="g"),
        sugar_alcohols=user_value(values.sugar_alcohols, unit="g"),
        protein=user_value(values.protein, unit="g"),
        fat=user_value(values.fat, unit="g"),
    )
    sugar_variants = classify_ingredients(request.raw_ingredients)
    glycemic, glycemic_limitations = build_glycemic_evidence(
        confirmed_nutrients,
        sugar_variants,
        product_name=request.product_name,
        raw_ingredients=request.raw_ingredients,
    )
    return LabelRecordValidationResponse(
        product_name=user_value(request.product_name, basis=None),
        serving_size=user_value(request.serving_size, unit=request.serving_unit, basis="per labeled serving"),
        serving_unit=request.serving_unit or None,
        nutrients=confirmed_nutrients,
        raw_ingredients=user_value(request.raw_ingredients, basis=None, image_kind="ingredients"),
        sugar_variants=sugar_variants,
        glycemic=glycemic,
        validation_checks=validation_checks,
        limitations=[
            f"Ingredient matches use taxonomy {SUGAR_TAXONOMY_VERSION}; they do not estimate ingredient amounts.",
            "Consumed servings are used only for the local log; they do not change the per-serving label snapshot.",
            "No licensed FNRI, Trinidad, or tested-product GI table is bundled.",
            "This tool does not provide medical advice, diabetes suitability claims, medication guidance, or glucose predictions.",
            *glycemic_limitations,
        ],
        provenance=Provenance(
            pipeline_version="manual-label-record-validation-v1",
            completed_at=datetime.now(timezone.utc),
            external_processors=[],
        ),
    )


async def event_stream(job: AnalysisJob) -> AsyncIterator[str]:
    index = 0
    while True:
        timed_out = False
        async with job.changed:
            while index >= len(job.events) and not job.done:
                try:
                    await asyncio.wait_for(job.changed.wait(), timeout=15)
                except asyncio.TimeoutError:
                    timed_out = True
                    break
            pending = job.events[index:]
            index = len(job.events)
            done = job.done
        if timed_out:
            yield ": keep-alive\n\n"
        for event in pending:
            yield f"data: {json.dumps(event, separators=(',', ':'))}\n\n"
        if done and index >= len(job.events):
            break


@app.get("/api/v1/analyses/{analysis_id}/events")
async def analysis_events(analysis_id: str) -> StreamingResponse:
    job = require_job(analysis_id)
    return StreamingResponse(
        event_stream(job),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.post(
    "/api/v1/analyses/{analysis_id}/finalize",
    response_model=AnalysisResult,
    response_model_by_alias=True,
)
async def finalize_analysis(analysis_id: str, request: FinalizeRequest) -> AnalysisResult:
    job = require_job(analysis_id)
    if not job.done or not job.result:
        raise HTTPException(status_code=409, detail="Analysis is still processing.")

    previous = clone_result(job.result)
    validated = validate_label_record(request)
    confirmed = AnalysisResult(
        analysis_id=analysis_id,
        status="confirmed",
        market=job.market,
        product=ProductIdentity(
            name=validated.product_name,
            brand=previous.product.brand,
            barcode=previous.product.barcode,
        ),
        serving=ServingInformation(
            size=validated.serving_size,
            unit=validated.serving_unit,
            household_measure=previous.serving.household_measure,
            servings_per_container=previous.serving.servings_per_container,
        ),
        nutrients=validated.nutrients,
        raw_ingredients=validated.raw_ingredients,
        sugar_variants=validated.sugar_variants,
        glycemic=validated.glycemic,
        quality_checks=previous.quality_checks,
        validation_checks=validated.validation_checks,
        limitations=validated.limitations,
        diagnostics=previous.diagnostics,
        retake_recommended=previous.retake_recommended,
        retake_reasons=previous.retake_reasons,
        provenance=Provenance(
            pipeline_version=previous.provenance.pipeline_version,
            completed_at=datetime.now(timezone.utc),
            external_processors=previous.provenance.external_processors,
        ),
    )
    job.result = confirmed
    return confirmed


@app.post(
    "/api/v1/label-records/validate",
    response_model=LabelRecordValidationResponse,
    response_model_by_alias=True,
)
async def validate_label_record_endpoint(request: FinalizeRequest) -> LabelRecordValidationResponse:
    return validate_label_record(request)


@app.get(
    "/api/v1/unlabeled-foods/catalog",
    response_model=UnlabeledFoodCatalogResponse,
    response_model_by_alias=True,
)
async def unlabeled_food_catalog(market: Literal["PH"] = "PH") -> UnlabeledFoodCatalogResponse:
    try:
        return catalog_response(market)
    except UnsupportedMarketError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.post(
    "/api/v1/unlabeled-foods/identify",
    response_model=UnlabeledFoodIdentifyResponse,
    response_model_by_alias=True,
)
async def identify_unlabeled_food(
    food_image: Annotated[UploadFile, File(...)],
    market: Annotated[Literal["PH"], Form(...)],
) -> UnlabeledFoodIdentifyResponse:
    content_type = food_image.content_type or ""
    if not content_type.startswith("image/"):
        raise HTTPException(status_code=422, detail="Use a JPEG, PNG, or WebP food photo.")
    await read_upload(food_image)
    try:
        return identify_candidates_from_filename(food_image.filename, market)
    except UnsupportedMarketError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.post(
    "/api/v1/unlabeled-food-records/validate",
    response_model=CuratedFoodRecord,
    response_model_by_alias=True,
)
async def validate_unlabeled_record_endpoint(request: UnlabeledFoodRecordRequest) -> CuratedFoodRecord:
    try:
        return validate_unlabeled_food_record(request)
    except UnknownFoodError as exc:
        raise HTTPException(status_code=404, detail="Curated demo food not found.") from exc
    except UnknownPortionError as exc:
        raise HTTPException(status_code=422, detail="Portion label is not allowed for this curated demo food.") from exc
    except UnsupportedMarketError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.delete("/api/v1/analyses/{analysis_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_analysis(analysis_id: str) -> Response:
    job = JOBS.pop(analysis_id, None)
    if job:
        delete_job_files(job)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
