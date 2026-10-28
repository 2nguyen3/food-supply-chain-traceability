import uuid

from fastapi import APIRouter, Depends, File, Form, Response, UploadFile
from sqlalchemy.orm import Session

from app.api.deps import current_wallet, get_chain, get_ipfs
from app.core.config import Settings, get_settings
from app.db.models import Document
from app.db.session import get_session
from app.schemas.documents import BindRequest, BindResponse, DocumentOut, GrantOut, GrantRequest
from app.services import document_service, upload_rules
from app.services.chain import ChainClient
from app.services.ipfs import PinataClient

router = APIRouter(prefix="/documents", tags=["documents"])


def _out(doc: Document) -> DocumentOut:
    return DocumentOut(
        id=doc.id, doc_type=doc.doc_type, visibility=doc.visibility,
        status="draft" if doc.token_id is None else "bound",
        cid=doc.cid, sha256=bytes(doc.sha256).hex(), mime_type=doc.mime_type, size_bytes=doc.size_bytes,
        uploader=doc.uploader, token_id=None if doc.token_id is None else str(int(doc.token_id)),
        created_at=doc.created_at,
    )


@router.post("", status_code=201, response_model=DocumentOut)
def upload_document(
    file: UploadFile = File(...),
    doc_type: str = Form(...),
    wallet: str = Depends(current_wallet),
    db: Session = Depends(get_session),
    chain: ChainClient = Depends(get_chain),
    ipfs: PinataClient = Depends(get_ipfs),
    settings: Settings = Depends(get_settings),
):
    upload_rules.require_uploader_role(chain, wallet, doc_type)  # vai trò on-chain trước khi đọc tệp
    content = upload_rules.read_limited(file.file)
    doc = document_service.create_document(db, ipfs, settings.master_key, wallet, doc_type, content)
    return _out(doc)


@router.post("/{document_id}/bind", response_model=BindResponse)
def bind_document(
    document_id: uuid.UUID,
    body: BindRequest,
    wallet: str = Depends(current_wallet),
    db: Session = Depends(get_session),
    chain: ChainClient = Depends(get_chain),
    settings: Settings = Depends(get_settings),
):
    doc = document_service.bind_document(
        db, chain, wallet, document_id, body.token_id, body.tx_hash, settings.deploy_block
    )
    return BindResponse(
        id=doc.id, status="bound", token_id=str(int(doc.token_id)), bind_tx_hash=doc.bind_tx_hash
    )


@router.get("/{document_id}/content")
def read_document_content(
    document_id: uuid.UUID,
    wallet: str = Depends(current_wallet),
    db: Session = Depends(get_session),
    chain: ChainClient = Depends(get_chain),
    ipfs: PinataClient = Depends(get_ipfs),
    settings: Settings = Depends(get_settings),
):
    doc, plaintext = document_service.read_private_document(
        db, chain, ipfs, settings.master_key, wallet, document_id
    )
    ext = document_service.EXTENSION.get(doc.mime_type, "bin")
    return Response(
        content=plaintext,
        media_type=doc.mime_type,
        headers={
            "Content-Disposition": f'attachment; filename="{doc.doc_type}-{str(doc.id)[:8]}.{ext}"',
            "X-Document-Sha256": bytes(doc.sha256).hex(),
            "Cache-Control": "no-store",
        },
    )


@router.post("/{document_id}/grants", response_model=GrantOut)
def grant_access(
    document_id: uuid.UUID,
    body: GrantRequest,
    response: Response,
    wallet: str = Depends(current_wallet),
    db: Session = Depends(get_session),
    chain: ChainClient = Depends(get_chain),
):
    grant, created = document_service.grant_access(db, chain, wallet, document_id, body.wallet)
    response.status_code = 201 if created else 200
    return GrantOut(
        document_id=grant.document_id, wallet=grant.wallet, granted_by=grant.granted_by,
        granted_at=grant.granted_at, revoked_at=grant.revoked_at,
    )


@router.delete("/{document_id}/grants/{target_wallet}", status_code=204)
def revoke_grant(
    document_id: uuid.UUID,
    target_wallet: str,
    wallet: str = Depends(current_wallet),
    db: Session = Depends(get_session),
):
    document_service.revoke_grant(db, wallet, document_id, target_wallet)
    return Response(status_code=204)
