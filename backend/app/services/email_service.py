# app/services/email_service.py

from app.zimbra.client import zimbra_soap
from app.repositories.email_tag_repo import email_tag_repo

FOLDER_QUERY: dict[str, str] = {
    "INBOX":   "in:inbox",
    "STARRED": "is:flagged",
    "SENT":    "in:sent",
    "SPAM":    "in:junk",
    "TRASH":   "in:trash",
}

TAG_RULES: list[tuple[str, list[str]]] = [
    ("red_team",  ["red team", "phishing", "pentest", "simulation", "redteam"]),
    ("security",  ["breach", "unauthorized", "security alert", "attack",
                   "vulnerability", "intrusion", "suspicious"]),
    ("hr",        ["interview", "candidate", "onboarding", "applicant",
                   " hr ", "recruitment", "hiring"]),
    ("tech",      ["deploy", "server", "downtime", "bug", "system update",
                   "dashboard", "technical", "version", "patch"]),
    ("offer",     ["invoice", "contract", "payment", "subscription",
                   "offer", "renewal", "quote"]),
    ("business",  ["partnership", "collaboration", "meeting", "client",
                   "deal", "agreement", "proposal"]),
]


def detect_tag(subject: str, preview: str) -> str | None:
    text = f" {subject} {preview} ".lower()
    for tag, keywords in TAG_RULES:
        if any(kw in text for kw in keywords):
            return tag
    return None


def _parse_summary(msg: dict) -> dict:
    flags  = msg.get("f", "")
    addrs  = msg.get("e", [])
    from_e = next((e for e in addrs if e.get("t") == "f"), {})
    return {
        "id":         msg.get("id"),
        "subject":    msg.get("su", "(no subject)"),
        "from_name":  from_e.get("p") or from_e.get("a", ""),
        "from_addr":  from_e.get("a", ""),
        "preview":    (msg.get("fr") or "")[:120],
        "date_ms":    msg.get("d", 0),
        "read":       "u" not in flags,
        "starred":    "f" in flags,
        "has_attach": "a" in flags,
        "tag":        None,
    }


async def get_folder(
    folder: str,
    zimbra_token: str,
    user_id: int,
    limit: int = 50
) -> list[dict]:
    query = FOLDER_QUERY.get(folder.upper(), "in:inbox")

    # ✅ No Body wrapper — zimbra_soap adds it automatically
    resp = await zimbra_soap(
        {
            "SearchRequest": {
                "_jsns":  "urn:zimbraMail",
                "query":  query,
                "types":  "message",
                "sortBy": "dateDesc",
                "limit":  limit,
            }
        },
        auth_token=zimbra_token,
    )

    raw    = resp.get("Body", {}).get("SearchResponse", {}).get("m", [])
    parsed = [_parse_summary(m) for m in raw]

    if not parsed:
        return []

    ids     = [e["id"] for e in parsed]
    tag_map = await email_tag_repo.get_tags_for_emails(user_id, ids)

    for email in parsed:
        stored = tag_map.get(email["id"])
        if stored:
            email["tag"] = stored
        else:
            detected = detect_tag(email["subject"], email["preview"])
            if detected:
                email["tag"] = detected
                await email_tag_repo.upsert(user_id, email["id"], detected)

    return parsed


async def get_email_detail(email_id: str, zimbra_token: str) -> dict:
    # ✅ No Body wrapper
    resp = await zimbra_soap(
        {
            "GetMsgRequest": {
                "_jsns": "urn:zimbraMail",
                "m": {"id": email_id, "html": 1, "read": 1, "max": 0},
            }
        },
        auth_token=zimbra_token,
    )

    msg    = resp["Body"]["GetMsgResponse"]["m"][0]
    addrs  = msg.get("e", [])
    from_e = next((e for e in addrs if e.get("t") == "f"), {})
    to_lst = [e.get("a") for e in addrs if e.get("t") == "t"]

    body = ""
    for part in msg.get("mp", []):
        if part.get("ct") == "text/html":
            body = part.get("content", "")
            break
    if not body:
        for part in msg.get("mp", []):
            if part.get("ct") == "text/plain":
                body = part.get("content", "")
                break

    return {
        "id":         msg.get("id"),
        "subject":    msg.get("su", "(no subject)"),
        "from_name":  from_e.get("p") or from_e.get("a", ""),
        "from_addr":  from_e.get("a", ""),
        "to":         to_lst,
        "date_ms":    msg.get("d", 0),
        "body":       body,
        "has_attach": bool(msg.get("a")),
    }


async def send_email(
    zimbra_token: str,
    to: str,
    subject: str,
    body: str,
    original_id: str | None = None,
) -> str:
    msg: dict = {
        "e":  [{"t": "t", "a": to}],
        "su": subject,
        "mp": [{"ct": "text/html", "content": body}],
    }
    if original_id and "@" not in original_id:
        print(f"Replying to email ID: {original_id}", flush=True)
        msg["rt"]  = "r"
        msg["oid"] = original_id
    else:
        print(f"Sending new email to: {to}", flush=True)

    resp = await zimbra_soap(
        {"SendMsgRequest": {"_jsns": "urn:zimbraMail", "m": msg}},
        auth_token=zimbra_token,
    )
    return resp["Body"]["SendMsgResponse"]["m"][0]["id"]

async def perform_action(
    zimbra_token: str,
    email_id: str,
    op: str
) -> None:
    # ✅ No Body wrapper
    await zimbra_soap(
        {
            "MsgActionRequest": {
                "_jsns":  "urn:zimbraMail",
                "action": {"id": email_id, "op": op},
            }
        },
        auth_token=zimbra_token,
    )


async def search_emails(
    zimbra_token: str,
    query: str,
    limit: int = 30
) -> list[dict]:
    # ✅ No Body wrapper
    resp = await zimbra_soap(
        {
            "SearchRequest": {
                "_jsns":  "urn:zimbraMail",
                "query":  query,
                "types":  "message",
                "sortBy": "dateDesc",
                "limit":  limit,
            }
        },
        auth_token=zimbra_token,
    )
    raw = resp.get("Body", {}).get("SearchResponse", {}).get("m", [])
    return [_parse_summary(m) for m in raw]