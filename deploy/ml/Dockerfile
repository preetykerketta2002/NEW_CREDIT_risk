FROM python:3.11-slim
WORKDIR /app
COPY deploy/ml/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY ml/api.py ./ml/api.py
COPY ml/models/saved_models/decision_tree.pkl ./ml/models/saved_models/decision_tree.pkl
ENV PYTHONUNBUFFERED=1
EXPOSE 8000
CMD ["uvicorn", "ml.api:app", "--host", "0.0.0.0", "--port", "8000"]
