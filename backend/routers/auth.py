"""
routers/auth.py
Auth endpoints: send-otp, verify-otp, google sign-in, login-password, signup
"""
import os
import random
import string
import time
import jwt
import sib_api_v3_sdk
import re
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from fastapi.security import OAuth2PasswordBearer

from database import get_db
from models import User

router = APIRouter()

# ── Password Hashing ──────────────────────────────────────────
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ── In-memory store for OTPs and Temp Signup data ──────────────
# Replace with Redis in production.
_otp_store: dict[str, tuple[str, float]] = {}
_signup_temp_store: dict[str, dict] = {}
_rate_limit_store: dict[str, list[float]] = {}  # email -> list of timestamps

OTP_TTL_SECONDS = 600  # 10 minutes

# ── JWT config ──────────────────────────────────────────────────
JWT_SECRET    = os.getenv("JWT_SECRET", "change_me")
JWT_ALGO      = os.getenv("JWT_ALGORITHM", "HS256")
JWT_EXPIRE_M  = int(os.getenv("JWT_EXPIRE_MINUTES", 10080))  # 7 days

# ── Brevo config ────────────────────────────────────────────────
BREVO_API_KEY     = os.getenv("BREVO_API_KEY", "")
BREVO_SENDER_EMAIL = os.getenv("BREVO_SENDER_EMAIL", "noreply@thingual.com")
BREVO_SENDER_NAME  = os.getenv("BREVO_SENDER_NAME", "Thingual")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login-password")

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
        user_id: int = payload.get("user_id")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Could not validate credentials")
    
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    return user

# ════════════════════════════════════════════════════════════════
# Helpers
# ════════════════════════════════════════════════════════════════

def _generate_otp(length: int = 6) -> str:
    return ''.join(random.choices(string.digits, k=length))

def _is_strong_password(password: str) -> bool:
    """Check for: 8 chars, 1 Upper, 1 Lower, 1 Digit, 1 Special."""
    if len(password) < 8: return False
    return all([
        re.search(r"[a-z]", password),
        re.search(r"[A-Z]", password),
        re.search(r"\d", password),
        re.search(r"[@$!%*?&]", password)
    ])

def _check_rate_limit(email: str, limit: int = 5, window: int = 600):
    """Simple in-memory rate limit: 5 requests per 10 mins."""
    now = time.time()
    times = _rate_limit_store.get(email, [])
    # Filter out old timestamps
    times = [t for t in times if t > now - window]
    if len(times) >= limit:
        return False
    times.append(now)
    _rate_limit_store[email] = times
    return True

def _create_jwt(payload: dict) -> str:
    data = {**payload, "exp": time.time() + JWT_EXPIRE_M * 60}
    return jwt.encode(data, JWT_SECRET, algorithm=JWT_ALGO)

def _send_otp_email(to_email: str, otp: str) -> None:
    """Send OTP via Brevo transactional email."""
    if not BREVO_API_KEY:
        print(f"DEBUG: BREVO_API_KEY not set. OTP for {to_email} is {otp}")
        return

    configuration = sib_api_v3_sdk.Configuration()
    configuration.api_key["api-key"] = BREVO_API_KEY
    api = sib_api_v3_sdk.TransactionalEmailsApi(sib_api_v3_sdk.ApiClient(configuration))

    html_content = f"""
    <div style="font-family:'Outfit',sans-serif;max-width:480px;margin:auto;padding:40px 32px;background:#ffffff;border-radius:16px;border:1px solid #E5E7EB;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:32px;">
        <div style="width:36px;height:36px;background:#2563EB;border-radius:10px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:18px;font-weight:800;text-align:center;line-height:36px;">T</div>
        <span style="font-size:22px;font-weight:700;color:#111827;">Thingual</span>
      </div>
      <h1 style="font-size:22px;font-weight:700;color:#111827;margin-bottom:8px;">Your verification code</h1>
      <p style="font-size:14px;color:#6B7280;margin-bottom:32px;line-height:1.6;">
        Use the code below to verify your email. It expires in <strong>10 minutes</strong>.
      </p>
      <div style="background:#EFF6FF;border:1.5px solid #BFDBFE;border-radius:12px;padding:24px;text-align:center;margin-bottom:32px;">
        <span style="font-size:40px;font-weight:800;letter-spacing:12px;color:#2563EB;">{otp}</span>
      </div>
      <p style="font-size:13px;color:#9CA3AF;line-height:1.6;">
        If you didn't request this code, you can safely ignore this email.
      </p>
    </div>
    """

    send_email = sib_api_v3_sdk.SendSmtpEmail(
        to=[{"email": to_email}],
        sender={"name": BREVO_SENDER_NAME, "email": BREVO_SENDER_EMAIL},
        subject="Your Thingual verification code",
        html_content=html_content,
    )
    api.send_transac_email(send_email)


# ════════════════════════════════════════════════════════════════
# Request Models
# ════════════════════════════════════════════════════════════════

class EmailOnlyRequest(BaseModel):
    email: EmailStr

class SignupRequest(BaseModel):
    email: EmailStr
    name: str
    password: str

class LoginPasswordRequest(BaseModel):
    email: EmailStr
    password: str

class VerifyOtpRequest(BaseModel):
    email: EmailStr
    otp: str

class GoogleAuthRequest(BaseModel):
    token: str
    userInfo: dict


# ════════════════════════════════════════════════════════════════
# Endpoints
# ════════════════════════════════════════════════════════════════

@router.post("/check-email")
async def check_email(body: EmailOnlyRequest, db: Session = Depends(get_db)):
    """Check if email exists in DB."""
    user = db.query(User).filter(User.email == body.email).first()
    return {"exists": user is not None}


@router.post("/signup")
async def signup(body: SignupRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """Start signup process - store info and send OTP."""
    # Rate limit check
    if not _check_rate_limit(body.email):
        raise HTTPException(status_code=429, detail="Too many attempts. Please try again later.")

    # Check if user already exists
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(status_code=400, detail="User already exists")

    # Validate password strength
    if not _is_strong_password(body.password):
        raise HTTPException(
            status_code=400, 
            detail="Password must be at least 8 characters long and include an uppercase letter, a lowercase letter, a number, and a special character."
        )

    # Store temp signup info (hashed password)
    hashed_password = pwd_context.hash(body.password)
    _signup_temp_store[body.email] = {
        "name": body.name,
        "password_hash": hashed_password
    }

    # Generate and send OTP
    otp = _generate_otp()
    _otp_store[body.email] = (otp, time.time() + OTP_TTL_SECONDS)

    background_tasks.add_task(_send_otp_email, body.email, otp)
    return {"message": "Verification code sent to email"}


@router.post("/login-password")
async def login_password(body: LoginPasswordRequest, db: Session = Depends(get_db)):
    """Login with email and password."""
    user = db.query(User).filter(User.email == body.email).first()
    if not user or not user.password_hash:
        raise HTTPException(status_code=400, detail="Invalid email or password")

    try:
        if not pwd_context.verify(body.password, user.password_hash):
            raise HTTPException(status_code=400, detail="Invalid email or password")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid email or password")

    token = _create_jwt({"user_id": user.id, "email": user.email, "name": user.name})
    return {
        "token": token,
        "email": user.email,
        "name": user.name,
        "is_new": False,
        "message": "Login successful"
    }


@router.post("/send-otp")
async def send_otp(body: EmailOnlyRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """Send OTP for login (only for existing users)."""
    if not _check_rate_limit(body.email):
        raise HTTPException(status_code=429, detail="Too many attempts. Please try again later.")

    user = db.query(User).filter(User.email == body.email).first()
    if not user:
        raise HTTPException(status_code=400, detail="User not found. Please sign up first.")

    otp = _generate_otp()
    _otp_store[body.email] = (otp, time.time() + OTP_TTL_SECONDS)

    background_tasks.add_task(_send_otp_email, body.email, otp)
    return {"message": "OTP sent successfully"}


@router.post("/verify-otp")
async def verify_otp(body: VerifyOtpRequest, db: Session = Depends(get_db)):
    """Verify OTP. If signup, create user. If login, return token."""
    record = _otp_store.get(body.email)
    if not record or time.time() > record[1]:
        _otp_store.pop(body.email, None)
        raise HTTPException(status_code=400, detail="Invalid or expired code")

    if body.otp != record[0]:
        raise HTTPException(status_code=400, detail="Incorrect verification code")

    # OTP is valid
    _otp_store.pop(body.email, None)

    # Check if this was a signup
    temp_user = _signup_temp_store.pop(body.email, None)
    if temp_user:
        # Finalize signup
        new_user = User(
            email=body.email,
            name=temp_user["name"],
            password_hash=temp_user["password_hash"]
        )
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        user = new_user
        is_new_user = True
    else:
        # Normal login
        user = db.query(User).filter(User.email == body.email).first()
        if not user:
            raise HTTPException(status_code=400, detail="User not found")
        is_new_user = False

    token = _create_jwt({"user_id": user.id, "email": user.email, "name": user.name})
    return {
        "token": token,
        "email": user.email,
        "name": user.name,
        "is_new": is_new_user,
        "message": "Verification successful"
    }


@router.post("/google")
async def google_auth(body: GoogleAuthRequest, db: Session = Depends(get_db)):
    """Google sign-in/up."""
    email = body.userInfo.get("email")
    name = body.userInfo.get("name", "User")
    
    user = db.query(User).filter(User.email == email).first()
    is_new_user = False
    if not user:
        # Create user automatically for Google
        user = User(email=email, name=name)
        db.add(user)
        db.commit()
        db.refresh(user)
        is_new_user = True

    token = _create_jwt({"user_id": user.id, "email": user.email, "name": user.name})
    return {
        "token": token,
        "email": user.email,
        "name": user.name,
        "is_new": is_new_user,
        "message": "Google authentication successful"
    }
