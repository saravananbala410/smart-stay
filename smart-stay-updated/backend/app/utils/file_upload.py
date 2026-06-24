"""
utils/file_upload.py - File upload: tries Cloudinary first, falls back to local disk
"""

import cloudinary
import cloudinary.uploader
import os
import uuid
from fastapi import UploadFile
from dotenv import load_dotenv

load_dotenv()

cloudinary.config(
    cloud_name = os.getenv("CLOUDINARY_CLOUD_NAME", ""),
    api_key    = os.getenv("CLOUDINARY_API_KEY", ""),
    api_secret = os.getenv("CLOUDINARY_API_SECRET", "")
)

UPLOAD_DIR = "uploads"

def _save_local(file_bytes: bytes, filename: str, subfolder: str) -> str:
    folder = os.path.join(UPLOAD_DIR, subfolder)
    os.makedirs(folder, exist_ok=True)
    ext  = filename.rsplit(".", 1)[-1] if "." in filename else "bin"
    name = f"{uuid.uuid4()}.{ext}"
    path = os.path.join(folder, name)
    with open(path, "wb") as f:
        f.write(file_bytes)
    return f"{subfolder}/{name}"   # relative path (served via /uploads/)


async def upload_to_cloudinary(file: UploadFile, folder: str = "smartstay") -> str:
    """Upload file — uses Cloudinary if configured, else saves locally."""
    contents = await file.read()

    cloud_name = os.getenv("CLOUDINARY_CLOUD_NAME", "")
    if cloud_name and cloud_name != "your_cloud_name":
        try:
            result = cloudinary.uploader.upload(
                contents,
                folder         = f"smartstay/{folder}",
                resource_type  = "auto",
                use_filename   = True,
                unique_filename= True
            )
            return result["secure_url"]
        except Exception as e:
            print(f"Cloudinary upload failed, saving locally: {e}")

    # Fallback: local disk
    return _save_local(contents, file.filename or "file", folder)
