FROM python:3.12-slim

WORKDIR /app
COPY requirements.txt /tmp/root-requirements.txt
COPY ml-service/requirements.txt /tmp/ml-requirements.txt
RUN pip install --no-cache-dir -r /tmp/root-requirements.txt \
    && pip install --no-cache-dir -r /tmp/ml-requirements.txt
COPY . /app/MLproject
ENV PYTHONPATH=/app
EXPOSE 8000
CMD ["uvicorn", "api:app", "--app-dir", "/app/MLproject/ml-service", "--host", "0.0.0.0", "--port", "8000"]
