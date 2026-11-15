"""Canonical FastAPI entry point for the credit risk backend.

Run locally with: uvicorn backend.main:app --reload --port 8000
"""
from ml.api import app

__all__ = ["app"]
