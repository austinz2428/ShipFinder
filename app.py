#!/usr/bin/env python3
"""
ShipFinder // Cloud Relay Universal Entrypoint
Supports direct execution (python server.py / python app.py)
and WSGI/ASGI runner environments.
"""
import asyncio
import os
import sys

from server import main, create_app

# Expose app instance for gunicorn / uvicorn / web frameworks
app = create_app()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
