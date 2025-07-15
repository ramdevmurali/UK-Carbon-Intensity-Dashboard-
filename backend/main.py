# backend/main.py

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging
# The '.' is a relative import to bring in our router
from . import api_router

# --- Application Setup ---
logging.basicConfig(level=logging.INFO)

app = FastAPI(
    title="UK Carbon Intensity API",
    description="A proxy API for the UK National Grid Carbon Intensity data.",
    version="2.5.0",
)

# --- Middleware ---
origins = ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins, 
    allow_credentials=True,
    allow_methods=["*"], 
    allow_headers=["*"],
)

# --- Routers ---
# This line tells the main app to include all the paths
# that we defined in the api_router.py file.
app.include_router(api_router.router)

# --- Root Endpoint ---
# This is a simple endpoint for health checks. It's fine to keep it here.
@app.get("/")
def read_root():
    return {"status": "ok", "message": "API is stable and correct."}