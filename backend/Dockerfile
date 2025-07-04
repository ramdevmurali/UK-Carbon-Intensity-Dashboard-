# backend/Dockerfile

# Use a version of Python that supports modern type hinting (3.10+)
FROM python:3.11-slim

# Install curl, which can be useful for debugging inside the container
RUN apt-get update && apt-get install -y curl

# Set the working directory in the container
WORKDIR /app

# Copy and install the dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application's code
COPY . .

# Expose the port the app runs on
EXPOSE 8001

# Define the command to run the application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]