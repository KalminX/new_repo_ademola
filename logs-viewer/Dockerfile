# Use a small base image
FROM python:3.11-alpine

# Install sqlite3 CLI
RUN apk add --no-cache sqlite

# Set working directory
WORKDIR /app

# Copy files
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Expose Flask port
EXPOSE 5000

# Run the app
CMD ["python", "app.py"]

