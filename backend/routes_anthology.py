"""
Anthology routes: CRUD, lift from highlights or raw snippet range, export.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import Response

from anthology import service
from anthology.export import build_dataset_zip, build_karaoke_zip

router = APIRouter(prefix="/api")


@router.get("/anthologies")
def list_anthologies():
    return service.list_anthologies()


@router.post("/anthologies")
async def create_anthology(request: Request):
    body = await request.json()
    name = (body.get("name") or "Untitled anthology").strip()
    preface = body.get("preface") or ""
    anth_id = service.create_anthology(name=name, preface=preface)
    return {"id": anth_id}


@router.get("/anthologies/{anth_id}")
def get_anthology(anth_id: int):
    try:
        return service.get_anthology(anth_id)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.patch("/anthologies/{anth_id}")
async def update_anthology(anth_id: int, request: Request):
    body = await request.json()
    try:
        service.update_anthology(
            anth_id,
            name=body.get("name"),
            preface=body.get("preface"),
        )
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return {"ok": True}


@router.post("/anthologies/{anth_id}/sections")
async def upsert_section(anth_id: int, request: Request):
    body = await request.json()
    section_id = service.upsert_section(
        anth_id,
        section_id=body.get("section_id"),
        title=body.get("title") or "",
        intro=body.get("intro") or "",
        idx=body.get("idx"),
    )
    return {"section_id": section_id}


@router.delete("/sections/{section_id}")
def delete_section(section_id: int):
    service.delete_section(section_id)
    return {"ok": True}


@router.post("/anthologies/{anth_id}/reorder-sections")
async def reorder_sections(anth_id: int, request: Request):
    body = await request.json()
    ids = body.get("section_ids") or []
    service.reorder_sections(anth_id, ids)
    return {"ok": True}


@router.post("/clips")
async def add_clip(request: Request):
    body = await request.json()
    try:
        clip_id = service.add_clip(
            section_id=int(body["section_id"]),
            conversation_id=int(body["conversation_id"]),
            start_sec=float(body["start_sec"]),
            end_sec=float(body["end_sec"]),
            tags=body.get("tags"),
            curator_note=body.get("curator_note") or "",
            source=body.get("source") or "manual",
            source_ref=body.get("source_ref"),
        )
    except KeyError as e:
        raise HTTPException(status_code=400, detail=f"Missing field: {e}")
    return {"clip_id": clip_id}


@router.patch("/clips/{clip_id}")
async def update_clip(clip_id: int, request: Request):
    body = await request.json()
    try:
        service.update_clip(
            clip_id,
            start_sec=body.get("start_sec"),
            end_sec=body.get("end_sec"),
            tags=body.get("tags"),
            curator_note=body.get("curator_note"),
            section_id=body.get("section_id"),
            idx=body.get("idx"),
        )
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return {"ok": True}


@router.delete("/clips/{clip_id}")
def delete_clip(clip_id: int):
    service.delete_clip(clip_id)
    return {"ok": True}


@router.post("/sections/{section_id}/reorder-clips")
async def reorder_clips(section_id: int, request: Request):
    body = await request.json()
    ids = body.get("clip_ids") or []
    service.reorder_clips(section_id, ids)
    return {"ok": True}


@router.get("/anthologies/{anth_id}/export")
def export_anthology(anth_id: int, format: str = Query("both"), embed: bool = Query(False)):
    """format: 'dataset' | 'karaoke' | 'both'."""
    try:
        if format == "dataset":
            data = build_dataset_zip(anth_id)
            filename = "anthology-dataset.zip"
        elif format == "karaoke":
            data = build_karaoke_zip(anth_id, embed_audio=embed)
            filename = "anthology-karaoke.zip"
        elif format == "both":
            import io
            import zipfile
            inner_dataset = build_dataset_zip(anth_id)
            inner_karaoke = build_karaoke_zip(anth_id, embed_audio=embed)
            buf = io.BytesIO()
            with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
                zf.writestr("dataset.zip", inner_dataset)
                zf.writestr("karaoke.zip", inner_karaoke)
            data = buf.getvalue()
            filename = "anthology-bundle.zip"
        else:
            raise HTTPException(status_code=400, detail="format must be 'dataset', 'karaoke', or 'both'")
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return Response(
        content=data,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
