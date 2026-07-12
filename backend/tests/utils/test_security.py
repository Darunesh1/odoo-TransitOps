from datetime import timedelta

from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)


def test_password_hashing():
    password = "supersecretpassword123"
    hashed = hash_password(password)

    assert hashed != password
    assert verify_password(password, hashed) is True
    assert verify_password("wrongpassword", hashed) is False


def test_jwt_tokens():
    subject = "user-12345"
    token = create_access_token(subject=subject, expires_delta=timedelta(minutes=5))

    decoded = decode_token(token)
    assert decoded is not None
    assert decoded["sub"] == subject
    assert decoded["type"] == "access"


def test_refresh_token():
    subject = "user-67890"
    token = create_refresh_token(subject=subject, expires_delta=timedelta(days=1))

    decoded = decode_token(token)
    assert decoded is not None
    assert decoded["sub"] == subject
    assert decoded["type"] == "refresh"


def test_decode_invalid_token():
    assert decode_token("invalidtokenstring") is None
