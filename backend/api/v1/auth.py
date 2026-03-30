"""
api.v1.auth
~~~~~~~~~~~
Authentication endpoints for Google OAuth and JWT management.
"""

from __future__ import annotations

from urllib.parse import urlencode

import structlog
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse, Response
from authlib.integrations.starlette_client import OAuth, OAuthError
from pydantic import BaseModel

from core.auth import create_access_token, create_refresh_token, get_current_user
from core.config import settings
from models.user import User


logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/auth", tags=["Authentication"])

# ── OAuth Setup ───────────────────────────────────────────────────────
oauth = OAuth()
oauth.register(
    name='google',
    server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
    client_id=settings.google_client_id,
    client_secret=settings.google_client_secret,
    client_kwargs={
        'scope': 'email openid profile',
    }
)

import os
# For local development, allow insecure (HTTP) transport
os.environ['OAUTHLIB_INSECURE_TRANSPORT'] = '1'


class RefreshTokenRequest(BaseModel):
    refresh_token: str


def _frontend_redirect(path: str, **params: str) -> str:
    base_url = settings.frontend_base_url.rstrip("/")
    query = urlencode(params)
    if query:
        return f"{base_url}{path}?{query}"
    return f"{base_url}{path}"


@router.get("/login/google", summary="Initiate Google OAuth login")
async def login_google(request: Request) -> Response:
    """
    Redirects the browser to Google's OAuth consent screen.
    """
    redirect_uri = settings.google_oauth_redirect_uri
    logger.info("auth.init_google_login", redirect_uri=redirect_uri)
    try:
        return await oauth.google.authorize_redirect(request, redirect_uri)
    except Exception as e:
        logger.error("auth.init_failed", error=str(e))
        return RedirectResponse(url=_frontend_redirect("/auth/error", detail="auth_init_failed"))


@router.get("/callback", summary="Google OAuth callback handler", name="auth_callback")
async def auth_callback(request: Request) -> RedirectResponse:
    """
    Handles the redirect from Google after successful login.
    Exchanges the code for tokens, creates/updates the user, and redirects to frontend.
    """
    try:
        token = await oauth.google.authorize_access_token(request)
        user_info = token.get('userinfo')
        logger.debug("auth.callback_tokens_received", token_keys=list(token.keys()))
        
        if not user_info:
            logger.error("auth.callback_no_userinfo")
            raise HTTPException(status_code=400, detail="Failed to fetch user info from Google")
        
        email = user_info["email"]
        display_name = user_info.get("name", email)
        google_id = user_info.get("sub")
        
        # Find or create user.
        user = await User.find_one(User.email == email)
        if not user:
            user = User(
                email=email,
                display_name=display_name,
                google_id=google_id
            )
            await user.insert()
            logger.info("auth.user_created", email=email)
        else:
            # Update google_id if it's new.
            user.google_id = google_id
            user.display_name = display_name
            await user.save()
            logger.info("auth.user_logged_in", email=email)

        # Generate tokens.
        access_token = create_access_token(data={"sub": user.email})
        refresh_token = create_refresh_token(data={"sub": user.email})
        
        # Store refresh token (optional, for revocation).
        user.refresh_token = refresh_token
        await user.save()

        # Redirect back to frontend with tokens as query params or set cookies.
        # Setting query params for simplicity in this PoC, but cookies are safer.
        # Redirect back to frontend on port 5173
        response_url = _frontend_redirect(
            "/auth/success",
            access_token=access_token,
            refresh_token=refresh_token,
        )
        logger.info("auth.callback_redirecting", url=response_url)
        return RedirectResponse(url=response_url)

    except OAuthError as e:
        if e.error == "mismatching_state":
            detail = "session_expired"
        else:
            logger.warning(
                "auth.callback_oauth_error",
                error=e.error,
                description=e.description,
            )
            detail = e.error or "oauth_error"
        return RedirectResponse(
            url=_frontend_redirect("/auth/error", detail=detail)
        )
    except Exception as e:
        logger.error("auth.callback_failed", error=str(e))
        return RedirectResponse(url=_frontend_redirect("/auth/error", detail="auth_callback_failed"))


@router.get("/me", summary="Get current logged-in user info")
async def get_me(current_user: User = Depends(get_current_user)) -> dict:
    """Returns the profile of the currently authenticated user."""
    return {
        "email": current_user.email,
        "display_name": current_user.display_name,
        "created_at": current_user.created_at,
        "history_count": len(current_user.history)
    }


@router.post("/refresh", summary="Rotate access token using refresh token")
async def refresh_token(payload: RefreshTokenRequest) -> dict:
    """
    Generates a new access token if the refresh token is valid.
    """
    from jose import jwt, JWTError
    refresh_token = payload.refresh_token
    try:
        payload = jwt.decode(
            refresh_token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm]
        )
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        
        email: str = payload.get("sub")
        user = await User.find_one(User.email == email)
        if not user or user.refresh_token != refresh_token:
            raise HTTPException(status_code=401, detail="Refresh token revoked or invalid")
        
        new_access_token = create_access_token(data={"sub": user.email})
        return {"access_token": new_access_token}
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")


@router.post("/logout", summary="Logout current user")
async def logout(current_user: User = Depends(get_current_user)) -> dict:
    """Clears the refresh token from the database."""
    current_user.refresh_token = None
    await current_user.save()
    return {"status": "ok", "message": "Logged out successfully"}
