"""Secure file upload validation"""

from fastapi import UploadFile, HTTPException, status
import mimetypes
import os
try:
    import magic  # python-magic for file type detection
except ImportError:
    magic = None
import logging

logger = logging.getLogger(__name__)

# Configuration
MAX_UPLOAD_SIZE = 10 * 1024 * 1024  # 10MB
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".pdf", ".doc", ".docx"}
ALLOWED_MIMETYPES = {
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}

# File signatures (magic bytes)
FILE_SIGNATURES = {
    b"\xff\xd8\xff": [".jpg", ".jpeg"],
    b"\x89PNG": ".png",
    b"GIF8": ".gif",
    b"%PDF": ".pdf",
    b"PK\x03\x04": [".docx", ".xlsx", ".pptx"],  # OOXML
    b"\xd0\xcf\x11": ".doc",  # OLE (old Office)
}

# Extended file validation for formats needing multi-byte-offset checks
def _check_magic_bytes(contents: bytes, file_ext: str) -> bool:
    for signature, ext in FILE_SIGNATURES.items():
        if contents.startswith(signature):
            if isinstance(ext, list):
                if file_ext in ext:
                    return True
            elif file_ext == ext:
                return True
    # Special check for WEBP (starts with RIFF, has WEBP at offset 8)
    if file_ext == ".webp" and contents[:4] == b"RIFF" and contents[8:12] == b"WEBP":
        return True
    return False


class FileUploadSecurityService:
    """Validate and secure file uploads"""

    @staticmethod
    async def validate_upload(file: UploadFile) -> None:
        """Validate file upload for security issues"""
        if not file or not file.filename:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No file provided",
            )

        # Check file size
        if (file.size or 0) > MAX_UPLOAD_SIZE:
            max_mb = MAX_UPLOAD_SIZE / 1024 / 1024
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File too large. Maximum size is {max_mb}MB",
            )

        # Check file extension
        file_ext = os.path.splitext(file.filename)[1].lower()
        if file_ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File type not allowed. Allowed types: {', '.join(ALLOWED_EXTENSIONS)}",
            )

        # Check MIME type from headers
        mime_type, _ = mimetypes.guess_type(file.filename)
        if mime_type and mime_type not in ALLOWED_MIMETYPES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid file MIME type: {mime_type}",
            )

        # Read file contents for magic byte verification
        contents = await file.read()
        await file.seek(0)  # Reset file pointer

        if not contents:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File is empty",
            )

        # Verify file signature (magic bytes)
        if not _check_magic_bytes(contents, file_ext):
            logger.warning(
                f"File signature mismatch: {file.filename} (ext: {file_ext})"
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File signature does not match file extension",
            )

        # Check for dangerous patterns
        try:
            if b"<script" in contents or b"<?php" in contents:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="File contains potentially dangerous content",
                )
        except Exception:
            pass  # Binary files might cause encoding issues

        logger.info(f"File upload validated: {file.filename} ({file.size} bytes)")

    @staticmethod
    def generate_safe_filename(original_filename: str, user_id: int) -> str:
        """Generate a safe filename for storage"""
        import uuid

        _, ext = os.path.splitext(original_filename)
        safe_name = f"{user_id}_{uuid.uuid4().hex}{ext.lower()}"
        return safe_name


def resize_and_save(image_data: bytes, filepath: str, max_dim: int = 1920) -> str | None:
    """Resize image to max_dim on longest side, maintaining aspect ratio, then save.
    Re-encodes as JPEG for consistency. Returns filepath on success."""
    try:
        from PIL import Image
        import io
        img = Image.open(io.BytesIO(image_data))
        if img.mode in ("RGBA", "LA", "P"):
            background = Image.new("RGB", img.size, (255, 255, 255))
            background.paste(img, mask=img.split()[-1] if img.mode == "RGBA" else None)
            img = background
        else:
            img = img.convert("RGB")
        w, h = img.size
        if w > max_dim or h > max_dim:
            if w > h:
                new_w = max_dim
                new_h = int(h * max_dim / w)
            else:
                new_h = max_dim
                new_w = int(w * max_dim / h)
            img = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
        out = io.BytesIO()
        img.save(out, format="JPEG", quality=85, optimize=True)
        out.seek(0)
        # Change extension to .jpg
        import os
        base, _ = os.path.splitext(filepath)
        jpg_path = base + ".jpg"
        with open(jpg_path, "wb") as f:
            f.write(out.getvalue())
        if jpg_path != filepath:
            try:
                os.remove(filepath)
            except OSError:
                pass
        return jpg_path
    except Exception:
        # Fallback: save original
        try:
            with open(filepath, "wb") as f:
                f.write(image_data)
            return filepath
        except Exception:
            return None
