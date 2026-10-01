from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.ai_service import chat, generate_flier_image, parse_flier_image

router = APIRouter()


class ChatRequest(BaseModel):
    messages: list[dict]


class FlierRequest(BaseModel):
    prompt: str


class ParseFlierRequest(BaseModel):
    image_data: str
    mime_type: str = "image/jpeg"


@router.post("/chat")
async def ai_chat(req: ChatRequest):
    reply = await chat(req.messages)
    return {"reply": reply}


@router.post("/generate-flier")
async def ai_generate_flier(req: FlierRequest):
    url = await generate_flier_image(req.prompt)
    if not url:
        raise HTTPException(status_code=503, detail="Image generation is temporarily unavailable. Please try again later.")
    return {"url": url}


@router.post("/parse-flier")
async def ai_parse_flier(req: ParseFlierRequest):
    try:
        result = await parse_flier_image(req.image_data, req.mime_type)
    except Exception:
        result = {}
    if not result:
        raise HTTPException(status_code=503, detail="AI not configured or could not read image.")
    return result
