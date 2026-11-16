"""Unified FastAPI app for predictions, rules, entities, and the frontend."""
import hashlib
import hmac
import os
import re
import secrets
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import joblib
import pandas as pd
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sqlalchemy import URL, create_engine, text
from sqlalchemy.exc import SQLAlchemyError

BASE_DIR = Path(__file__).resolve().parents[1]
load_dotenv(BASE_DIR / "backend" / ".env")
model = joblib.load(BASE_DIR / "ml/models/saved_models/decision_tree.pkl")
NUMERICAL_FEATURES = ["interest_coverage", "debt_to_equity", "dscr", "ebitda_margin_pct", "current_ratio", "cash_usd_m", "operating_cf_usd_m", "net_debt_usd_m", "years_in_operation", "dso_days", "fx_revenue_pct", "collateral_coverage_pct"]
CATEGORICAL_FEATURES = ["sector", "country", "ownership_type", "auditor_tier", "industry_cyclicality", "hedging_policy", "covenant_quality", "sanctions_exposure", "financials_audited"]
FEATURES = NUMERICAL_FEATURES + CATEGORICAL_FEATURES


class CreditApplication(BaseModel):
    model_config = {"extra": "allow"}
    interest_coverage: float
    debt_to_equity: float
    dscr: float
    ebitda_margin_pct: float
    current_ratio: float
    cash_usd_m: float
    operating_cf_usd_m: float
    net_debt_usd_m: float
    years_in_operation: float
    dso_days: float
    fx_revenue_pct: float
    collateral_coverage_pct: float
    sector: str
    country: str
    ownership_type: str
    auditor_tier: str
    industry_cyclicality: str
    hedging_policy: str
    covenant_quality: str
    sanctions_exposure: str
    financials_audited: str


class SearchHistoryRequest(BaseModel):
    query: str


class AuthRequest(BaseModel):
    email: str
    password: str
    full_name: str | None = None


def database_url() -> str | URL:
    if value := os.getenv("DATABASE_URL"):
        return value.replace("mysql://", "mysql+pymysql://", 1)
    return URL.create(
        "mysql+pymysql", username=os.getenv("DB_USER", "root"),
        password=os.getenv("DB_PASS", ""), host=os.getenv("DB_HOST", "localhost"),
        port=int(os.getenv("DB_PORT", "3306")), database=os.getenv("DB_NAME", "credit"),
    )


engine = create_engine(database_url(), pool_pre_ping=True, pool_recycle=1800)
app = FastAPI(title="Credit Risk API", description="Credit risk evaluation and prediction API", version="2.0.0")
allowed_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://frontend-iota-ten-43.vercel.app",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "ngrok-skip-browser-warning"],
)


def ensure_search_history_table(connection, user_id: int | None = None):
    connection.execute(text("""CREATE TABLE IF NOT EXISTS search_history (
        search_id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        user_id BIGINT NULL,
        search_query VARCHAR(255) NOT NULL,
        searched_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_search_history_user_query (user_id, search_query),
        INDEX idx_search_history_searched_at (searched_at)
    ) ENGINE=InnoDB"""))
    columns = {row["Field"] for row in connection.execute(text("SHOW COLUMNS FROM search_history")).mappings()}
    if "user_id" not in columns:
        connection.execute(text("ALTER TABLE search_history ADD COLUMN user_id BIGINT NULL AFTER search_id"))
    index_rows = connection.execute(text("SHOW INDEX FROM search_history")).mappings().all()
    grouped: dict[str, list[tuple[int, str]]] = {}
    unique_indexes = set()
    for row in index_rows:
        name = row["Key_name"]
        grouped.setdefault(name, []).append((int(row["Seq_in_index"]), row["Column_name"]))
        if int(row["Non_unique"]) == 0:
            unique_indexes.add(name)
    for name in unique_indexes:
        indexed_columns = [column for _, column in sorted(grouped[name])]
        if indexed_columns == ["search_query"]:
            connection.execute(text(f"ALTER TABLE search_history DROP INDEX `{name}`"))
    index_rows = connection.execute(text("SHOW INDEX FROM search_history")).mappings().all()
    grouped = {}
    for row in index_rows:
        grouped.setdefault(row["Key_name"], []).append((int(row["Seq_in_index"]), row["Column_name"]))
    has_user_query_unique = any(
        [column for _, column in sorted(columns_for_index)] == ["user_id", "search_query"]
        for columns_for_index in grouped.values()
    )
    if not has_user_query_unique:
        connection.execute(text("CREATE UNIQUE INDEX uq_search_history_user_query ON search_history(user_id, search_query)"))
    if user_id is not None:
        connection.execute(text("UPDATE search_history SET user_id=:user_id WHERE user_id IS NULL"), {"user_id": user_id})


def ensure_auth_tables(connection):
    connection.execute(text("""CREATE TABLE IF NOT EXISTS app_users (
        user_id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(254) NOT NULL UNIQUE,
        full_name VARCHAR(120) NOT NULL,
        password_hash VARCHAR(512) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB"""))
    connection.execute(text("""CREATE TABLE IF NOT EXISTS auth_sessions (
        session_id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        user_id BIGINT NOT NULL,
        token_hash CHAR(64) NOT NULL UNIQUE,
        expires_at DATETIME NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_auth_sessions_user_id (user_id),
        CONSTRAINT fk_auth_session_user FOREIGN KEY (user_id)
            REFERENCES app_users(user_id) ON DELETE CASCADE
    ) ENGINE=InnoDB"""))


def token_digest(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    rounds = 600_000
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, rounds)
    return f"pbkdf2_sha256${rounds}${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        algorithm, rounds, salt_hex, expected_hex = stored.split("$", 3)
        if algorithm != "pbkdf2_sha256":
            return False
        actual = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), bytes.fromhex(salt_hex), int(rounds))
        return hmac.compare_digest(actual.hex(), expected_hex)
    except (ValueError, TypeError):
        return False


def new_session(connection, user_id: int) -> tuple[str, datetime]:
    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=7)
    connection.execute(text("""INSERT INTO auth_sessions (user_id, token_hash, expires_at)
        VALUES (:user_id, :token_hash, :expires_at)"""), {
        "user_id": user_id, "token_hash": token_digest(token), "expires_at": expires_at,
    })
    return token, expires_at


def session_cookie_options(request: Request) -> dict[str, Any]:
    same_site = os.getenv("SESSION_COOKIE_SAMESITE", "strict").strip().lower()
    if same_site not in {"strict", "lax", "none"}:
        raise RuntimeError("SESSION_COOKIE_SAMESITE must be strict, lax, or none")
    secure_setting = os.getenv("SESSION_COOKIE_SECURE")
    secure = request.url.scheme == "https" if secure_setting is None else secure_setting.strip().lower() in {"1", "true", "yes"}
    if same_site == "none" and not secure:
        raise RuntimeError("SESSION_COOKIE_SECURE must be true when SESSION_COOKIE_SAMESITE=none")
    return {"httponly": True, "secure": secure, "samesite": same_site, "path": "/"}


def set_session_cookie(response: Response, request: Request, token: str, expires_at: datetime):
    max_age = max(0, int((expires_at - datetime.now(timezone.utc).replace(tzinfo=None)).total_seconds()))
    response.set_cookie(
        key="credence_session", value=token, max_age=max_age,
        **session_cookie_options(request),
    )


def require_user(request: Request) -> dict[str, Any]:
    token = request.cookies.get("credence_session")
    if not token:
        raise HTTPException(status_code=401, detail="Please sign in")
    try:
        with engine.begin() as conn:
            ensure_auth_tables(conn)
            user = conn.execute(text("""SELECT u.user_id, u.email, u.full_name
                FROM app_users u JOIN auth_sessions s ON s.user_id=u.user_id
                WHERE s.token_hash=:token_hash AND s.expires_at > UTC_TIMESTAMP()"""),
                {"token_hash": token_digest(token)}).mappings().first()
        if not user:
            raise HTTPException(status_code=401, detail="Please sign in")
        return dict(user)
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=500, detail="Unable to verify sign-in") from exc

FACTOR_MAPPINGS = {
    "auditor_tier": {"Other": 0, "Big4": 1}, "financials_audited": {"No": 0, "Yes": 1},
    "industry_cyclicality": {"Low": 0, "Medium": 1, "High": 2},
    "hedging_policy": {"None": 0, "Partial": 1, "Comprehensive": 2},
    "covenant_quality": {"Weak": 0, "Standard": 1, "Strong": 2},
    "sanctions_exposure": {"None": 0, "Indirect": 1, "Direct": 2},
}
THRESHOLD_KEYS = {
    "auditor_tier": "auditor_tier_code (Other=0, Big4=1)",
    "financials_audited": "financials_audited_code (No=0, Yes=1)",
    "industry_cyclicality": "industry_cyclicality_code (Low=0, Medium=1, High=2)",
    "hedging_policy": "hedging_policy_code (None=0, Partial=1, Comprehensive=2)",
    "covenant_quality": "covenant_quality_code (Weak=0, Standard=1, Strong=2)",
    "sanctions_exposure": "sanctions_exposure_code (None=0, Indirect=1, Direct=2)",
}
EVALUATION_FACTORS = [
    "revenue_usd_m", "ebitda_margin_pct", "ebit_margin_pct", "debt_to_equity", "interest_coverage", "dscr",
    "current_ratio", "quick_ratio", "revenue_cagr_3y_pct", "years_in_operation", "auditor_tier",
    "governance_score_0_100", "esg_controversies_3y", "country_risk_0_100", "industry_cyclicality",
    "fx_revenue_pct", "hedging_policy", "collateral_coverage_pct", "covenant_quality",
    "payment_incidents_12m", "legal_disputes_open", "sanctions_exposure", "financials_audited",
]


def predict(application: CreditApplication) -> Any:
    result = model.predict(pd.DataFrame([application.model_dump()])[FEATURES])[0]
    return result.item() if hasattr(result, "item") else result


def evaluate_rules(entity: dict[str, Any]) -> dict[str, Any]:
    results: dict[str, Any] = {}
    counts = {"Low": 0, "Medium": 0, "High": 0}
    with engine.connect() as conn:
        for factor in EVALUATION_FACTORS:
            value = entity.get(factor)
            if value is None or value == "":
                results[factor] = None
                continue
            mapping = FACTOR_MAPPINGS.get(factor)
            if mapping:
                if value not in mapping:
                    results[factor] = {"error": f"Invalid value '{value}' for factor '{factor}'"}
                    continue
                value = mapping[value]
            rows = conn.execute(text("SELECT start_range,end_range,evaluation FROM factor_thresholds WHERE factor_key=:key ORDER BY threshold_id ASC"), {"key": THRESHOLD_KEYS.get(factor, factor)}).mappings().all()
            if not rows:
                results[factor] = {"error": f"No rules found for factor: {factor}"}
                continue
            evaluation = next((r["evaluation"] for r in rows if r["start_range"] is not None and r["end_range"] is not None and float(r["start_range"]) <= float(value) <= float(r["end_range"])), None)
            results[factor] = evaluation
            if evaluation:
                counts[evaluation] += 1
    return {"entity_id": entity.get("entity_id"), "factor_evaluations": results, "summary": {"low": counts["Low"], "medium": counts["Medium"], "high": counts["High"]}}


@app.get("/")
def root():
    index = BASE_DIR / "frontend/dist/index.html"
    return FileResponse(index) if index.exists() else {"message": "Credit Risk API is running", "model": "Decision Tree"}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/api/auth/register")
def register_user(data: AuthRequest, request: Request, response: Response):
    email = data.email.strip().lower()
    full_name = (data.full_name or "").strip()
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email) or len(email) > 254:
        raise HTTPException(status_code=422, detail="Enter a valid email address")
    if len(full_name) < 2 or len(full_name) > 120:
        raise HTTPException(status_code=422, detail="Name must be between 2 and 120 characters")
    if len(data.password) < 12 or len(data.password) > 128:
        raise HTTPException(status_code=422, detail="Password must be between 12 and 128 characters")

    try:
        with engine.begin() as conn:
            ensure_auth_tables(conn)
            result = conn.execute(text("""INSERT INTO app_users (email, full_name, password_hash)
                VALUES (:email,:full_name,:password_hash)"""), {
                "email": email, "full_name": full_name, "password_hash": hash_password(data.password),
            })
            user_id = int(result.lastrowid)
            token, expires_at = new_session(conn, user_id)
        set_session_cookie(response, request, token, expires_at)
        return {"user": {"user_id": user_id, "email": email, "full_name": full_name}}
    except SQLAlchemyError as exc:
        if getattr(getattr(exc, "orig", None), "args", [None])[0] == 1062:
            raise HTTPException(status_code=409, detail="An account with this email already exists") from exc
        raise HTTPException(status_code=500, detail="Unable to create the account") from exc


@app.post("/api/auth/login")
def login_user(data: AuthRequest, request: Request, response: Response):
    email = data.email.strip().lower()
    if len(data.password) > 128:
        raise HTTPException(status_code=422, detail="Password must be 128 characters or fewer")
    try:
        with engine.begin() as conn:
            ensure_auth_tables(conn)
            user = conn.execute(text("SELECT user_id,email,full_name,password_hash FROM app_users WHERE email=:email"),
                                {"email": email}).mappings().first()
            stored_hash = user["password_hash"] if user else "pbkdf2_sha256$600000$00000000000000000000000000000000$" + "0" * 64
            valid_password = verify_password(data.password, stored_hash)
            if not user or not valid_password:
                raise HTTPException(status_code=401, detail="Email or password is incorrect")
            token, expires_at = new_session(conn, int(user["user_id"]))
        set_session_cookie(response, request, token, expires_at)
        return {"user": {"user_id": user["user_id"], "email": user["email"], "full_name": user["full_name"]}}
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=500, detail="Unable to sign in") from exc


@app.get("/api/auth/me")
def current_user(user: dict[str, Any] = Depends(require_user)):
    return {"user": user}


@app.post("/api/auth/logout")
def logout_user(request: Request, response: Response):
    token = request.cookies.get("credence_session")
    if token:
        try:
            with engine.begin() as conn:
                ensure_auth_tables(conn)
                conn.execute(text("DELETE FROM auth_sessions WHERE token_hash=:token_hash"),
                             {"token_hash": token_digest(token)})
        except SQLAlchemyError as exc:
            raise HTTPException(status_code=500, detail="Unable to sign out") from exc
    response.delete_cookie("credence_session", **session_cookie_options(request))
    return {"logged_out": True}


@app.get("/api/search-history")
def get_search_history(user: dict[str, Any] = Depends(require_user)):
    try:
        with engine.begin() as conn:
            ensure_auth_tables(conn)
            ensure_search_history_table(conn, int(user["user_id"]))
            rows = conn.execute(text("""SELECT search_id, search_query AS query, searched_at
                FROM search_history WHERE user_id=:user_id
                ORDER BY searched_at DESC, search_id DESC LIMIT 10"""),
                {"user_id": int(user["user_id"])}).mappings().all()
        return [dict(row) for row in rows]
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=500, detail=f"Unable to load search history: {exc}") from exc


@app.post("/api/search-history")
def save_search_history(request: SearchHistoryRequest, user: dict[str, Any] = Depends(require_user)):
    query = request.query.strip()
    if not query:
        raise HTTPException(status_code=422, detail="Search query cannot be empty")
    query = query[:255]
    try:
        with engine.begin() as conn:
            ensure_auth_tables(conn)
            user_id = int(user["user_id"])
            ensure_search_history_table(conn, user_id)
            conn.execute(text("""INSERT INTO search_history (user_id, search_query, searched_at)
                VALUES (:user_id, :query, CURRENT_TIMESTAMP)
                ON DUPLICATE KEY UPDATE searched_at=CURRENT_TIMESTAMP"""), {"user_id": user_id, "query": query})
            conn.execute(text("""DELETE FROM search_history WHERE search_id NOT IN
                (SELECT search_id FROM (SELECT search_id FROM search_history
                WHERE user_id=:user_id ORDER BY searched_at DESC, search_id DESC LIMIT 10) recent_searches)
                AND user_id=:user_id"""), {"user_id": user_id})
            row = conn.execute(text("""SELECT search_id, search_query AS query, searched_at
                FROM search_history WHERE user_id=:user_id AND search_query=:query"""),
                {"user_id": user_id, "query": query}).mappings().one()
        return dict(row)
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=500, detail=f"Unable to save search history: {exc}") from exc


@app.delete("/api/search-history")
def clear_search_history(user: dict[str, Any] = Depends(require_user)):
    try:
        with engine.begin() as conn:
            ensure_auth_tables(conn)
            user_id = int(user["user_id"])
            ensure_search_history_table(conn, user_id)
            conn.execute(text("DELETE FROM search_history WHERE user_id=:user_id"), {"user_id": user_id})
        return {"cleared": True}
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=500, detail=f"Unable to clear search history: {exc}") from exc


@app.post("/predict")
@app.post("/api/ml/predict")
def predict_risk(application_data: CreditApplication, user: dict[str, Any] = Depends(require_user)):
    try:
        return {"predicted_risk": predict(application_data)}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/api/credit-risk/entities")
def get_entities(user: dict[str, Any] = Depends(require_user)):
    try:
        with engine.connect() as conn:
            rows = conn.execute(text("""SELECT e.*,c.id AS outcome_id,c.pd_1y_pct,c.lgd_pct,c.ead_usd_m,c.risk_bucket,c.implied_rating,c.created_at AS outcome_created_at,c.updated_at AS outcome_updated_at FROM entities e LEFT JOIN credit_outcomes c ON c.entity_id=e.entity_id ORDER BY e.entity_id ASC""")).mappings().all()
        result = []
        for row in rows:
            item = dict(row)
            outcome_id = item.pop("outcome_id")
            outcome = None
            if outcome_id is not None:
                outcome = {"id": outcome_id, "entity_id": item["entity_id"]}
                for key in ("pd_1y_pct", "lgd_pct", "ead_usd_m", "risk_bucket", "implied_rating"):
                    outcome[key] = item.pop(key)
                outcome["created_at"] = item.pop("outcome_created_at")
                outcome["updated_at"] = item.pop("outcome_updated_at")
            else:
                for key in ("pd_1y_pct", "lgd_pct", "ead_usd_m", "risk_bucket", "implied_rating", "outcome_created_at", "outcome_updated_at"):
                    item.pop(key)
            item["CreditOutcome"] = outcome
            result.append(item)
        return result
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=500, detail={"message": "Failed to fetch entities", "error": str(exc)}) from exc


@app.post("/api/credit-risk/evaluate")
def evaluate_credit_risk(data: dict[str, Any], user: dict[str, Any] = Depends(require_user)):
    if not data:
        raise HTTPException(status_code=500, detail={"message": "Credit risk evaluation failed", "error": "Application data is required", "details": None})
    try:
        rules = evaluate_rules(data)
        ml_result = predict(CreditApplication.model_validate(data))
        summary = rules["summary"]
        status = "Review Required" if ml_result == "High" or summary["high"] else "Review Recommended" if summary["medium"] else "Normal"
        signal = "High" if summary["high"] else "Medium" if summary["medium"] else "Low"
        factors = [{"factor": k, "evaluation": v} for k, v in rules["factor_evaluations"].items() if v == "High" or v == "Medium"]
        return {"entity_id": data.get("entity_id"), "final_evaluation": ml_result, "ml_prediction": ml_result, "rule_assessment": summary, "signals_agree": ml_result == signal, "decision_status": status, "risk_factors": factors, "factor_evaluations": rules["factor_evaluations"]}
    except Exception as exc:
        raise HTTPException(status_code=500, detail={"message": "Credit risk evaluation failed", "error": str(exc), "details": None}) from exc


frontend_dist = BASE_DIR / "frontend/dist"
if frontend_dist.exists():
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")
