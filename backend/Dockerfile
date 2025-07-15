# backend/Dockerfile

FROM python:3.11-slim

RUN apt-get update && apt-get install -y curl

# Set the working directory. This will be the root for our python path.
WORKDIR /app

# Copy requirements FIRST, to leverage Docker caching.
# Note: We copy it into the WORKDIR, not a subdirectory yet.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Now, copy the application code into a 'backend' subdirectory.
# This creates the structure /app/backend/main.py
COPY . ./backend/

# Expose the port
EXPOSE 8001

# This command works because the WORKDIR is /app and it can find the 'backend' module within it.
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8001", "--reload"]