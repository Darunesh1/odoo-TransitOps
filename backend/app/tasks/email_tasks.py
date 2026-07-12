import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.core.celery_app import celery_app
from app.core.config import settings

logger = logging.getLogger(__name__)


def send_email(recipient: str, subject: str, html_content: str) -> str:
    """Helper method to send an HTML email using SMTP or log it if SMTP configuration is missing."""
    smtp_configured = all(
        [
            settings.SMTP_HOST,
            settings.SMTP_PORT,
            settings.SMTP_USER,
            settings.SMTP_PASSWORD,
        ]
    )

    if not smtp_configured:
        logger.info("=== [MOCK EMAIL DISPATCHED] ===")
        logger.info(f"Recipient: {recipient}")
        logger.info(f"Subject:   {subject}")
        logger.info("--- CONTENT ---")
        logger.info(html_content.strip())
        logger.info("==============================")
        return f"Mock email dispatched to {recipient}"

    # Build standard SMTP mime message
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{settings.EMAILS_FROM_NAME} <{settings.EMAILS_FROM_EMAIL}>"
    msg["To"] = recipient
    msg.attach(MIMEText(html_content, "html"))

    try:
        # Connect, secure via TLS, login and send
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:  # type: ignore
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)  # type: ignore
            server.sendmail(
                settings.EMAILS_FROM_EMAIL, recipient, msg.as_string()  # type: ignore
            )
        logger.info(f"Real email successfully sent to: {recipient}")
        return f"Real email sent to {recipient}"
    except Exception as e:
        logger.error(f"Failed to send real email to {recipient} via SMTP: {e}")
        raise e


@celery_app.task(name="app.tasks.email_tasks.send_verification_email")
def send_verification_email(email: str, token: str, full_name: str = "") -> str:
    """Celery task to send email verification links asynchronously."""
    # Build verification URL (usually pointing to our frontend or relative API link)
    verification_link = f"http://localhost:8000/auth/verify-email?token={token}"
    subject = "Verify your email address"

    html_body = f"""
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2 style="color: #4F46E5;">Email Verification</h2>
        <p>Hi {full_name or 'User'},</p>
        <p>Thank you for signing up! Please verify your email by clicking the link below:</p>
        <p style="margin: 20px 0;">
          <a href="{verification_link}" style="background-color: #4F46E5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Verify Email</a>
        </p>
        <p>If you did not request this, you can safely ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="font-size: 12px; color: #888;">This is an automated message from {settings.EMAILS_FROM_NAME}.</p>
      </body>
    </html>
    """
    return send_email(email, subject, html_body)


@celery_app.task(name="app.tasks.email_tasks.send_welcome_email")
def send_welcome_email(email: str, full_name: str = "") -> str:
    """Celery task to send a welcome email after verification."""
    subject = f"Welcome to {settings.EMAILS_FROM_NAME}!"

    html_body = f"""
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2 style="color: #10B981;">Welcome Aboard!</h2>
        <p>Hi {full_name or 'User'},</p>
        <p>Your email has been successfully verified, and your account is now fully active.</p>
        <p>We're thrilled to have you here. You can now log in and explore all features.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="font-size: 12px; color: #888;">Thank you, the {settings.EMAILS_FROM_NAME} team.</p>
      </body>
    </html>
    """
    return send_email(email, subject, html_body)
