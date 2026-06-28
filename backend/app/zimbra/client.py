import imaplib
import httpx
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.parser import BytesParser
from email.policy import default
from email.utils import parsedate_to_datetime, parseaddr, formatdate, make_msgid
from typing import List, Dict
import asyncio
from concurrent.futures import ThreadPoolExecutor
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail, Header, Email
from app.config import get_settings

executor = ThreadPoolExecutor(max_workers=5)

# ---------------------------------------------------------------------------
# zimbra_soap — SOAP/JSON client used by email_service.py
# ---------------------------------------------------------------------------
async def zimbra_soap(payload: dict, auth_token: str) -> dict:
    settings = get_settings()
    url = f"{settings.zimbra_url}/service/soap"
    async with httpx.AsyncClient(verify=settings.zimbra_verify_ssl, timeout=30) as client:
        resp = await client.post(
            url,
            json={
                "Body": payload,
                "Header": {"context": {"_jsns": "urn:zimbra", "authToken": {"_content": auth_token}}},
            },
        )
        resp.raise_for_status()
        return resp.json()

FOLDER_MAP = {
    "INBOX":   ["INBOX"],
    "SENT":    ["Sent", "Sent Messages", "INBOX.Sent"],
    "SPAM":    ["Junk", "Spam", "INBOX.Junk"],
    "TRASH":   ["Trash", "Deleted Items", "INBOX.Trash"],
    "STARRED": ["INBOX"],
}


def _parse_from(raw):
    name, addr = parseaddr(raw or "")
    return {
        "from_name": name.strip() if name.strip() else addr,
        "from_addr": addr.strip(),
    }


def _select_folder(imap, folder_key):
    candidates = FOLDER_MAP.get(folder_key.upper(), [folder_key])
    for name in candidates:
        status, _ = imap.select(name)
        if status == "OK":
            print(f"Selected folder: {name}", flush=True)
            return True
    return False


def _parse_msg(msg_id, msg, flags_str):
    from_raw   = msg.get("From", "")
    from_parts = _parse_from(from_raw)
    body = ""
    if msg.is_multipart():
        for part in msg.walk():
            ct = part.get_content_type()
            cd = str(part.get("Content-Disposition", ""))
            if ct == "text/plain" and "attachment" not in cd:
                payload = part.get_payload(decode=True)
                if payload:
                    body = payload.decode("utf-8", errors="ignore")
                    break
        if not body:
            for part in msg.walk():
                if part.get_content_type() == "text/html":
                    payload = part.get_payload(decode=True)
                    if payload:
                        body = payload.decode("utf-8", errors="ignore")
                        break
    else:
        payload = msg.get_payload(decode=True)
        if payload:
            body = payload.decode("utf-8", errors="ignore")

    # Extract attachments
    attachments = []
    if msg.is_multipart():
        for part in msg.walk():
            cd = str(part.get("Content-Disposition", ""))
            if "attachment" in cd:
                filename = part.get_filename() or "attachment"
                size = len(part.get_payload(decode=True) or b"")
                content_type = part.get_content_type()
                attachments.append({
                    "filename": filename,
                    "size": size,
                    "content_type": content_type,
                })

    date_str = msg.get("Date", "")
    date_ms  = None
    try:
        if date_str:
            date_ms = int(parsedate_to_datetime(date_str).timestamp() * 1000)
    except Exception:
        pass

    mid = msg_id.decode() if isinstance(msg_id, bytes) else str(msg_id)
    return {
        "id":         mid,
        "message_id": (msg.get("Message-ID") or "").strip(),
        "in_reply_to": (msg.get("In-Reply-To") or "").strip(),
        "references":  (msg.get("References") or "").strip(),
        "from_name":  from_parts["from_name"],
        "from_addr":  from_parts["from_addr"],
        "from":       from_raw,
        "to":         msg.get("To", ""),
        "subject":    (msg.get("Subject", "") or "(no subject)")[:200],
        "date":       date_str,
        "date_ms":    date_ms,
        "body":       body,
        "preview":    body[:120].strip() if body else "",
        "read":       "\\Seen"    in flags_str,
        "starred":    "\\Flagged" in flags_str,
        "has_attach": len(attachments) > 0,
        "attachments": attachments,
    }


class ZimbraIMAPClient:
    def __init__(self, imap_port=993, smtp_port=587):
        self.imap_port = imap_port
        self.smtp_port = smtp_port

    @property
    def host(self):
        return get_settings().zimbra_host

    def _imap(self, email, password):
        imap = imaplib.IMAP4_SSL(self.host, self.imap_port)
        imap.login(email, password)
        return imap

    def _smtp(self, email, password):
        import smtplib
        smtp = smtplib.SMTP(self.host, self.smtp_port)
        smtp.starttls()
        smtp.login(email, password)
        return smtp

    async def get_folder_emails(self, email, password, folder, limit=100):
        def _sync():
            try:
                imap = self._imap(email, password)
                if not _select_folder(imap, folder):
                    imap.logout()
                    return []
                if folder.upper() == "STARRED":
                    status, ids = imap.search(None, "FLAGGED")
                else:
                    status, ids = imap.search(None, "ALL")
                if status != "OK" or not ids[0]:
                    imap.logout()
                    return []

                # Take newest N IDs
                id_list = ids[0].split()[::-1][:limit]

                if not id_list:
                    imap.logout()
                    return []

                # Batch fetch ALL emails in ONE IMAP round-trip
                # Build comma-separated ID string e.g. "5,4,3,2,1"
                id_set = b",".join(id_list)
                st, data = imap.fetch(id_set, "(RFC822 FLAGS)")
                if st != "OK" or not data:
                    imap.logout()
                    return []

                emails   = []
                seen_ids = set()
                i        = 0

                while i < len(data):
                    part = data[i]
                    # Each message is a tuple followed by b")"
                    if isinstance(part, tuple):
                        header_info = part[0].decode() if isinstance(part[0], bytes) else str(part[0])
                        raw_msg     = part[1]
                        flags_str   = header_info

                        # Get the IMAP sequence number from header line like "5 (FLAGS (...) RFC822 {size}"
                        seq_match = __import__("re").match(r"(\d+)", header_info)
                        seq_num   = seq_match.group(1).encode() if seq_match else b"0"

                        try:
                            msg    = BytesParser(policy=default).parsebytes(raw_msg)
                            parsed = _parse_msg(seq_num, msg, flags_str)
                            msg_id_header = msg.get("Message-ID", "") or parsed["id"]
                            if msg_id_header not in seen_ids:
                                seen_ids.add(msg_id_header)
                                emails.append(parsed)
                        except Exception as e:
                            print(f"Parse error: {e}", flush=True)
                    i += 1

                imap.logout()
                # Sort newest first
                emails.sort(key=lambda e: e.get("date_ms") or 0, reverse=True)
                return emails
            except Exception as e:
                print(f"IMAP error: {e}", flush=True)
                return []
        return await asyncio.get_event_loop().run_in_executor(executor, _sync)

    async def get_email_detail(self, email, password, email_id, folder="INBOX"):
        def _sync():
            try:
                imap = self._imap(email, password)
                if not _select_folder(imap, folder):
                    imap.select("INBOX")
                st, data = imap.fetch(email_id, "(RFC822 FLAGS)")
                if st != "OK":
                    raise ValueError(f"Cannot fetch {email_id}")
                flags_str = ""
                raw_msg   = None
                for part in data:
                    if isinstance(part, tuple):
                        raw_msg = part[1]
                    elif isinstance(part, bytes):
                        flags_str = part.decode()
                if raw_msg is None:
                    raise ValueError("No data")
                imap.store(email_id, "+FLAGS", "\\Seen")
                msg    = BytesParser(policy=default).parsebytes(raw_msg)
                parsed = _parse_msg(email_id.encode() if isinstance(email_id, str) else email_id, msg, flags_str)
                parsed["read"] = True
                imap.logout()
                return parsed
            except Exception as e:
                print(f"Detail error: {e}", flush=True)
                raise
        return await asyncio.get_event_loop().run_in_executor(executor, _sync)

    async def get_email_by_message_id(self, email, password, message_id, folder="INBOX"):
        def _sync():
            try:
                imap = self._imap(email, password)
                if not _select_folder(imap, folder):
                    imap.logout()
                    raise ValueError(f"Folder {folder} not accessible")
                # IMAP HEADER search does substring matching — try the stored value
                # as-is, then without angle brackets as fallback
                clean = message_id.strip()
                variants = [clean]
                if clean.startswith("<") and clean.endswith(">"):
                    variants.append(clean[1:-1])
                else:
                    variants.append(f"<{clean}>")
                seq_num = None
                for v in variants:
                    st, ids = imap.search(None, f'HEADER Message-ID "{v}"')
                    if st == "OK" and ids[0]:
                        seq_num = ids[0].split()[-1]
                        break
                if seq_num is None:
                    imap.logout()
                    raise ValueError("Email not found by Message-ID")
                st2, data = imap.fetch(seq_num, "(RFC822 FLAGS)")
                if st2 != "OK":
                    imap.logout()
                    raise ValueError("Cannot fetch email")
                flags_str = ""
                raw_msg   = None
                for part in data:
                    if isinstance(part, tuple):
                        raw_msg = part[1]
                    elif isinstance(part, bytes):
                        flags_str = part.decode()
                if raw_msg is None:
                    imap.logout()
                    raise ValueError("No data")
                msg    = BytesParser(policy=default).parsebytes(raw_msg)
                parsed = _parse_msg(seq_num, msg, flags_str)
                imap.logout()
                return parsed
            except Exception as e:
                print(f"get_email_by_message_id error: {e}", flush=True)
                raise
        return await asyncio.get_event_loop().run_in_executor(executor, _sync)

    async def search_emails(self, email, password, query, folder="INBOX", limit=50):
        def _sync():
            try:
                imap = self._imap(email, password)
                if not _select_folder(imap, folder):
                    imap.select("INBOX")
                # TEXT searches full message: headers (From, To, Subject, Date) + body
                st, ids = imap.search(None, f'TEXT "{query}"')
                if st != "OK" or not ids[0]:
                    imap.logout()
                    return []
                id_list = ids[0].split()[::-1][:limit]
                if not id_list:
                    imap.logout()
                    return []
                id_set = b",".join(id_list)
                st2, data = imap.fetch(id_set, "(RFC822 FLAGS)")
                if st2 != "OK" or not data:
                    imap.logout()
                    return []
                emails   = []
                seen_ids = set()
                for part in data:
                    if isinstance(part, tuple):
                        header_info = part[0].decode() if isinstance(part[0], bytes) else str(part[0])
                        raw_msg     = part[1]
                        flags_str   = header_info
                        seq_match   = __import__("re").match(r"(\d+)", header_info)
                        seq_num     = seq_match.group(1).encode() if seq_match else b"0"
                        try:
                            msg    = BytesParser(policy=default).parsebytes(raw_msg)
                            parsed = _parse_msg(seq_num, msg, flags_str)
                            mid_hdr = msg.get("Message-ID", "") or parsed["id"]
                            if mid_hdr not in seen_ids:
                                seen_ids.add(mid_hdr)
                                emails.append(parsed)
                        except Exception as e:
                            print(f"Search parse error: {e}", flush=True)
                imap.logout()
                emails.sort(key=lambda e: e.get("date_ms") or 0, reverse=True)
                return emails
            except Exception as e:
                print(f"Search error: {e}", flush=True)
                return []
        return await asyncio.get_event_loop().run_in_executor(executor, _sync)

    async def send_email(self, email, password, to, subject, body,
                         in_reply_to=None, attachments=None):
        """
        attachments: list of (filename, content_type, bytes) tuples, or None.
        """
        def _sync():
            try:
                import base64
                from email.mime.base import MIMEBase
                from email import encoders as email_encoders
                settings = get_settings()

                # Build MIME message (used for SMTP + IMAP Sent copy)
                msg               = MIMEMultipart()
                msg["From"]       = email
                msg["To"]         = to
                msg["Subject"]    = subject
                msg["Date"]       = formatdate(localtime=True)
                msg["Message-ID"] = make_msgid()
                message_id = str(msg["Message-ID"])  # capture for return
                if in_reply_to:
                    msg["In-Reply-To"] = in_reply_to
                    msg["References"]  = in_reply_to
                msg.attach(MIMEText(body, "plain"))

                # Attach files to MIME message
                for filename, content_type, data in (attachments or []):
                    maintype, subtype = (content_type.split('/', 1)
                                         if '/' in content_type
                                         else ('application', 'octet-stream'))
                    part = MIMEBase(maintype, subtype)
                    part.set_payload(data)
                    email_encoders.encode_base64(part)
                    part.add_header('Content-Disposition', 'attachment',
                                    filename=filename)
                    msg.attach(part)

                # Route: same domain → SMTP, external → SendGrid
                sender_domain    = email.split("@")[-1].lower()
                recipient_domain = to.split("@")[-1].lower()

                if sender_domain == recipient_domain:
                    smtp = self._smtp(email, password)
                    smtp.send_message(msg)
                    smtp.quit()
                    print(f"Sent via SMTP (internal: {sender_domain})", flush=True)
                else:
                    from sendgrid.helpers.mail import (
                        ReplyTo, Attachment, FileContent, FileName,
                        FileType, Disposition,
                    )
                    sender_name = email.split("@")[0].replace(".", " ").title()
                    sg_mail = Mail(
                        from_email=Email(settings.sendgrid_from_email, sender_name),
                        to_emails=to,
                        subject=subject,
                        plain_text_content=body,
                    )
                    sg_mail.reply_to = ReplyTo(email)
                    headers = [Header("Message-ID", message_id)]
                    if in_reply_to:
                        headers += [
                            Header("In-Reply-To", in_reply_to),
                            Header("References",  in_reply_to),
                        ]
                    sg_mail.header = headers
                    for filename, content_type, data in (attachments or []):
                        att = Attachment(
                            FileContent(base64.b64encode(data).decode()),
                            FileName(filename),
                            FileType(content_type),
                            Disposition('attachment'),
                        )
                        sg_mail.attachment = att
                    sg = SendGridAPIClient(settings.sg_api_key)
                    response = sg.send(sg_mail)
                    print(f"Sent via SendGrid (external), status: {response.status_code}", flush=True)

                # Save a copy to Sent folder via IMAP
                raw  = msg.as_bytes()
                imap = self._imap(email, password)
                for folder in ["Sent", "Sent Messages", "INBOX.Sent"]:
                    st, _ = imap.select(folder)
                    if st == "OK":
                        imap.append(folder, "\\Seen", None, raw)
                        print(f"Saved to Sent folder: {folder}", flush=True)
                        break
                imap.logout()
                return message_id
            except Exception as e:
                print(f"Send error (full): {type(e).__name__}: {e}", flush=True)
                if hasattr(e, 'body'):
                    print(f"SendGrid body: {e.body}", flush=True)
                if hasattr(e, 'status_code'):
                    print(f"SendGrid status: {e.status_code}", flush=True)
                return None
        return await asyncio.get_event_loop().run_in_executor(executor, _sync)

    async def mark_as_read(self, email, password, email_id, folder="INBOX"):
        def _sync():
            try:
                imap = self._imap(email, password)
                folders_to_try = list(dict.fromkeys(
                    FOLDER_MAP.get(folder.upper(), ["INBOX"]) + ["INBOX"]
                ))
                for f in folders_to_try:
                    st, _ = imap.select(f)
                    if st == "OK":
                        imap.store(email_id, "+FLAGS", "\\Seen")
                        imap.logout()
                        return True
                imap.logout()
                return False
            except Exception as e:
                print(f"Mark read error: {e}", flush=True)
                return False
        return await asyncio.get_event_loop().run_in_executor(executor, _sync)

    async def star_email(self, email, password, email_id, starred, folder="INBOX"):
        def _sync():
            try:
                imap  = self._imap(email, password)
                # Try the given folder first, then fall back to INBOX
                folders_to_try = list(dict.fromkeys(
                    FOLDER_MAP.get(folder.upper(), ["INBOX"]) + ["INBOX"]
                ))
                flag = "+FLAGS" if starred else "-FLAGS"
                for f in folders_to_try:
                    st, _ = imap.select(f)
                    if st == "OK":
                        imap.store(email_id, flag, "\\Flagged")
                        imap.logout()
                        return True
                imap.logout()
                return False
            except Exception as e:
                print(f"Star error: {e}", flush=True)
                return False
        return await asyncio.get_event_loop().run_in_executor(executor, _sync)


    async def move_to_trash(self, email: str, password: str, email_id: str, source: str = "INBOX") -> bool:
        def _sync():
            try:
                imap = self._imap(email, password)
                trash_folders = ["Trash", "Deleted Items", "INBOX.Trash"]
                trash = "Trash"
                for f in trash_folders:
                    st, _ = imap.select(f)
                    if st == "OK":
                        trash = f
                        break
                if not _select_folder(imap, source):
                    imap.select("INBOX")
                imap.copy(email_id, trash)
                imap.store(email_id, "+FLAGS", "\\Deleted")
                imap.expunge()
                imap.logout()
                return True
            except Exception as e:
                print(f"Trash error: {e}", flush=True)
                return False
        return await asyncio.get_event_loop().run_in_executor(executor, _sync)

    async def move_to_spam(self, email: str, password: str, email_id: str, source: str = "INBOX") -> bool:
        def _sync():
            try:
                imap = self._imap(email, password)
                spam_folders = ["Junk", "Spam", "INBOX.Junk"]
                spam = "Junk"
                for f in spam_folders:
                    st, _ = imap.select(f)
                    if st == "OK":
                        spam = f
                        break
                if not _select_folder(imap, source):
                    imap.select("INBOX")
                imap.copy(email_id, spam)
                imap.store(email_id, "+FLAGS", "\\Deleted")
                imap.expunge()
                imap.logout()
                return True
            except Exception as e:
                print(f"Spam error: {e}", flush=True)
                return False
        return await asyncio.get_event_loop().run_in_executor(executor, _sync)

    async def move_from_spam(self, email: str, password: str, email_id: str) -> bool:
        def _sync():
            try:
                imap = self._imap(email, password)
                spam_folders = ["Junk", "Spam", "INBOX.Junk"]
                spam = None
                for f in spam_folders:
                    st, _ = imap.select(f)
                    if st == "OK":
                        spam = f
                        break
                if not spam:
                    imap.logout()
                    return False
                imap.copy(email_id, "INBOX")
                imap.store(email_id, "+FLAGS", "\\Deleted")
                imap.expunge()
                imap.logout()
                print(f"Moved {email_id} from spam to INBOX", flush=True)
                return True
            except Exception as e:
                print(f"Not spam error: {e}", flush=True)
                return False
        return await asyncio.get_event_loop().run_in_executor(executor, _sync)


    async def permanent_delete(self, email: str, password: str, email_id: str) -> bool:
        def _sync():
            try:
                imap = self._imap(email, password)
                trash_folders = ["Trash", "Deleted Items", "INBOX.Trash"]
                for f in trash_folders:
                    st, _ = imap.select(f)
                    if st == "OK":
                        imap.store(email_id, "+FLAGS", "\\Deleted")
                        imap.expunge()
                        imap.logout()
                        print(f"Permanently deleted {email_id} from {f}", flush=True)
                        return True
                imap.logout()
                return False
            except Exception as e:
                print(f"Permanent delete error: {e}", flush=True)
                return False
        return await asyncio.get_event_loop().run_in_executor(executor, _sync)

    async def move_from_trash(self, email: str, password: str, email_id: str) -> bool:
        def _sync():
            try:
                imap = self._imap(email, password)
                trash_folders = ["Trash", "Deleted Items", "INBOX.Trash"]
                trash = None
                for f in trash_folders:
                    st, _ = imap.select(f)
                    if st == "OK":
                        trash = f
                        break
                if not trash:
                    imap.logout()
                    return False
                imap.copy(email_id, "INBOX")
                imap.store(email_id, "+FLAGS", "\\Deleted")
                imap.expunge()
                imap.logout()
                print(f"Moved {email_id} from trash to INBOX", flush=True)
                return True
            except Exception as e:
                print(f"Restore from trash error: {e}", flush=True)
                return False
        return await asyncio.get_event_loop().run_in_executor(executor, _sync)

    async def get_attachment(self, email: str, password: str, email_id: str,
                             filename: str, folder: str = "INBOX") -> dict:
        """Fetch a specific attachment from an email. Returns {content, content_type}."""
        def _sync():
            try:
                imap = self._imap(email, password)
                if not _select_folder(imap, folder):
                    imap.select("INBOX")
                st, data = imap.fetch(email_id, "(RFC822)")
                if st != "OK":
                    imap.logout()
                    return None
                raw_msg = None
                for part in data:
                    if isinstance(part, tuple):
                        raw_msg = part[1]
                        break
                if raw_msg is None:
                    imap.logout()
                    return None
                msg = BytesParser(policy=default).parsebytes(raw_msg)
                imap.logout()
                # Find attachment by filename
                if msg.is_multipart():
                    for part in msg.walk():
                        cd = str(part.get("Content-Disposition", ""))
                        if "attachment" in cd:
                            part_filename = part.get_filename() or "attachment"
                            if part_filename == filename:
                                content = part.get_payload(decode=True)
                                content_type = part.get_content_type()
                                return {
                                    "content": content,
                                    "content_type": content_type,
                                }
                return None
            except Exception as e:
                print(f"Attachment fetch error: {e}", flush=True)
                return None
        return await asyncio.get_event_loop().run_in_executor(executor, _sync)


zimbra_client = ZimbraIMAPClient()
