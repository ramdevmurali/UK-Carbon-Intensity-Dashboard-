# backend/Dockerfile

FROM python:3.9-slim

# Install curl, which we'll use for the healthcheck
RUN apt-get update && apt-get install -y curl

WORKDIR /app

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]