from typing import Any


def ok(data: Any = None, message: str = "OK") -> dict[str, Any]:
    return {"success": True, "message": message, "data": data}


def page(items: list[Any], total: int, page_number: int, size: int) -> dict[str, Any]:
    return ok({"items": items, "total": total, "page": page_number, "size": size})
