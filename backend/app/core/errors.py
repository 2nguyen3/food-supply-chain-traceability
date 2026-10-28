"""Lỗi API dạng {"error": {"code", "message"}} (thay cho {"detail": ...} mặc định của FastAPI)."""
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


class ApiError(Exception):
    def __init__(self, status_code: int, code: str, message: str):
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message


def _body(code: str, message: str) -> dict:
    return {"error": {"code": code, "message": message}}


def _domain_errors() -> dict:
    """Ánh xạ lỗi nghiệp vụ (services) -> (HTTP, code, thông báo mặc định). Import muộn để tránh vòng."""
    from app.core.crypto import CiphertextInvalid, CryptoConfigError
    from app.services import auth_service as a, document_service as d, upload_rules as u
    from app.services.chain import ChainUnavailable
    from app.services.ipfs import IpfsFetchError, IpfsUploadError

    return {
        ChainUnavailable: (503, "CHAIN_UNAVAILABLE", "Không đọc được dữ liệu từ blockchain"),
        IpfsUploadError: (502, "IPFS_UPLOAD_FAILED", "Upload IPFS thất bại, hãy thử lại"),
        IpfsFetchError: (502, "IPFS_FETCH_FAILED", "Không tải được tài liệu từ IPFS"),
        d.AccessDenied: (403, "ACCESS_DENIED", "Bạn không có quyền đọc tài liệu này"),
        CiphertextInvalid: (502, "CIPHERTEXT_INVALID", "Dữ liệu mã hóa bị hỏng hoặc đã bị sửa"),
        CryptoConfigError: (500, "SERVER_MISCONFIGURED", "Máy chủ chưa cấu hình khóa mã hóa"),
        u.FileTooLarge: (413, "FILE_TOO_LARGE", "Tệp vượt giới hạn 10 MB"),
        u.UnsupportedContent: (415, "UNSUPPORTED_CONTENT", "Nội dung tệp không khớp doc_type"),
        u.InvalidDocType: (422, "INVALID_REQUEST", "doc_type không hợp lệ"),
        u.RoleRequired: (403, "ROLE_REQUIRED", "Ví thiếu vai trò cho loại tài liệu này"),
        a.InvalidWallet: (422, "INVALID_WALLET", "Địa chỉ ví không hợp lệ"),
        d.DocumentNotFound: (404, "DOCUMENT_NOT_FOUND", "Không tìm thấy tài liệu"),
        d.NotUploader: (403, "NOT_UPLOADER", "Chỉ người upload mới thực hiện được"),
        d.AlreadyBound: (409, "ALREADY_BOUND", "Tài liệu đã gắn vào lô hoặc giao dịch khác"),
        d.TxReceiptInvalid: (422, "TX_RECEIPT_INVALID", "Receipt không hợp lệ"),
        d.HashMismatch: (422, "HASH_MISMATCH", "sha256 hoặc cid không khớp dữ liệu trên chain"),
        d.DocumentIsPublic: (400, "DOCUMENT_IS_PUBLIC", "Tài liệu công khai, đọc trực tiếp từ IPFS"),
        d.WalletNotEligible: (422, "WALLET_NOT_ELIGIBLE", "Ví chưa có vai trò nghiệp vụ trên contract"),
        d.GrantNotFound: (404, "GRANT_NOT_FOUND", "Không có quyền đọc nào cần thu hồi"),
        d.InvalidRequest: (422, "INVALID_REQUEST", "Yêu cầu không hợp lệ"),
    }


def register_error_handlers(app: FastAPI) -> None:
    def make(status: int, code: str, default: str):
        async def handler(_: Request, exc: Exception):
            # Chỉ lộ thông báo của lỗi nghiệp vụ có message chủ đích; lỗi hạ tầng dùng thông báo mặc định.
            detail = str(exc) if status in (400, 403, 409, 413, 415, 422) and str(exc) else default
            return JSONResponse(status_code=status, content=_body(code, detail))
        return handler

    for exc_type, (status, code, default) in _domain_errors().items():
        app.add_exception_handler(exc_type, make(status, code, default))

    @app.exception_handler(ApiError)
    async def _api_error(_: Request, exc: ApiError):
        return JSONResponse(status_code=exc.status_code, content=_body(exc.code, exc.message))

    @app.exception_handler(RequestValidationError)
    async def _validation(_: Request, exc: RequestValidationError):
        return JSONResponse(status_code=422, content=_body("INVALID_REQUEST", "Dữ liệu gửi lên không hợp lệ"))

    http_codes = {401: "UNAUTHENTICATED", 403: "FORBIDDEN", 404: "NOT_FOUND", 405: "METHOD_NOT_ALLOWED"}

    @app.exception_handler(StarletteHTTPException)
    async def _http(_: Request, exc: StarletteHTTPException):
        code = http_codes.get(exc.status_code, "HTTP_ERROR")
        return JSONResponse(status_code=exc.status_code, content=_body(code, str(exc.detail)))

    @app.exception_handler(Exception)
    async def _unexpected(_: Request, exc: Exception):
        # Không lộ chi tiết nội bộ (đường dẫn, câu SQL, khóa) ra client
        return JSONResponse(status_code=500, content=_body("INTERNAL_ERROR", "Lỗi máy chủ"))
