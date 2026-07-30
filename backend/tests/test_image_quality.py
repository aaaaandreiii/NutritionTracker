from io import BytesIO

from PIL import Image, ImageDraw

from app.pipeline import inspect_and_sanitize_image


def jpeg_bytes(image: Image.Image) -> bytes:
    buffer = BytesIO()
    image.save(buffer, format="JPEG", quality=95)
    return buffer.getvalue()


def check_status(checks, suffix: str) -> str:
    return next(check.status for check in checks if check.code.endswith(suffix))


def test_white_label_with_strong_text_is_not_rejected_as_glare(tmp_path):
    image = Image.new("RGB", (1000, 1400), "white")
    draw = ImageDraw.Draw(image)
    for y in range(60, 1340, 28):
        draw.rectangle((80, y, 920, y + 10), fill="#0d3265")

    checks = inspect_and_sanitize_image(
        jpeg_bytes(image),
        "image/jpeg",
        tmp_path / "sanitized.jpg",
        "nutrition",
    )

    assert check_status(checks, "_focus") == "pass"
    assert check_status(checks, "_glare") == "warn"


def test_clipped_detail_less_image_still_fails(tmp_path):
    image = Image.new("RGB", (1000, 1400), "white")
    checks = inspect_and_sanitize_image(
        jpeg_bytes(image),
        "image/jpeg",
        tmp_path / "sanitized.jpg",
        "nutrition",
    )

    assert check_status(checks, "_focus") == "fail"
    assert check_status(checks, "_glare") == "fail"
