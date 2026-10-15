"""HTML email bodies. Every interpolated value is escaped."""
from html import escape


def _frame(title: str, color: str, body_html: str, footer: str) -> str:
    return f"""
    <div style="font-family: monospace; padding: 20px; border: 1px solid {color}; background-color: #FAF9F6;">
        <h2 style="color: {color}; border-bottom: 1px solid {color}; padding-bottom: 10px;">{escape(title)}</h2>
        {body_html}
        <hr style="border: 0; border-top: 1px dashed {color};" />
        <p style="font-size: 10px; color: gray;">{escape(footer)}</p>
    </div>
    """


def test_dispatch(message: str) -> str:
    return _frame(
        "DEMEURE AI // COMMAND", "#1E3A5F",
        f"<p><strong>ALERT DISPATCH TEST</strong></p><p>{escape(message)}</p>",
        "This message is routed through Amazon SES Notification Channel.",
    )


def leave_submitted(leave: dict, attachment_url: str = "") -> str:
    attachment = (
        f'<a href="{escape(attachment_url, quote=True)}">View Uploaded Document</a>'
        if attachment_url else "None"
    )
    return _frame(
        "DEMEURE AI // COMMAND", "#1E3A5F",
        f"""<p><strong>LEAVE APPLICATION SUBMITTED</strong></p>
        <p>Your ward, <strong>{escape(leave['name'])}</strong>, room <strong>{escape(leave['room'])}</strong>,
        has requested leave from campus.</p>
        <ul>
            <li>Duration: {escape(leave['duration'])}</li>
            <li>Reason: {escape(leave['reason'])}</li>
            <li>Attachment: {attachment}</li>
        </ul>""",
        "Demeure Safety Protocol Rule 08 - Auto Email Alerts.",
    )


def leave_resolved(leave: dict, approved: bool) -> str:
    if approved:
        return _frame(
            "DEMEURE AI // LEAVE RESOLVED", "#22c55e",
            f"""<p>The Warden Security Desk has <strong>APPROVED</strong> your leave request
            <strong>{escape(leave['id'])}</strong>.</p>
            <p><strong>Duration:</strong> {escape(leave['duration'])}</p>""",
            "You are cleared for exit. Ensure biometric swipe on exit.",
        )
    return _frame(
        "DEMEURE AI // LEAVE RESOLVED", "#b91c1c",
        f"""<p>The Warden Security Desk has <strong>DENIED</strong> your leave request
        <strong>{escape(leave['id'])}</strong>.</p>
        <p>Please meet the Warden in person to clear any details.</p>""",
        "Safety Protocol active. Unauthorized exit will trigger alert.",
    )


def visitor_resolved(visitor: dict) -> str:
    approved = visitor["status"] == "Approved"
    code = f"<p>Gate pass code: <strong>{escape(visitor.get('passCode', ''))}</strong></p>" if approved else ""
    return _frame(
        "DEMEURE AI // VISITOR PASS", "#22c55e" if approved else "#b91c1c",
        f"""<p>Your visitor request for <strong>{escape(visitor['visitor'])}</strong>
        ({escape(visitor['date'])}) has been <strong>{escape(visitor['status'].upper())}</strong>.</p>{code}""",
        "Visitors must present the pass code and a photo ID at Gate SOC-G1.",
    )


def access_code_issued(name: str, email: str, room: str, code: str, reset: bool = False) -> str:
    action = "has been reset" if reset else "has been created"
    return _frame(
        "DEMEURE AI // COMMAND", "#1E3A5F",
        f"""<p><strong>{'ACCESS CODE RESET' if reset else 'WELCOME TO DEMEURE AI'}</strong></p>
        <p>Dear <strong>{escape(name)}</strong>, your resident account {action}.</p>
        <ul>
            <li>Sign-in e-mail: {escape(email)}</li>
            <li>Access code: <strong style="letter-spacing: 2px;">{escape(code)}</strong></li>
            <li>Room: {escape(room)}</li>
        </ul>
        <p>Sign in under <em>Resident Student</em>. Do not share this code; staff will never ask for it.</p>""",
        "Demeure resident onboarding. If you did not expect this e-mail, contact the warden's office.",
    )
