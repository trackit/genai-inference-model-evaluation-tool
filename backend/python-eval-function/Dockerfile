FROM python:3.12-slim

WORKDIR /src

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --upgrade pip

RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN python -m nltk.downloader wordnet punkt_tab


COPY src/ .

ENV PYTHONUNBUFFERED=1

CMD ["python", "main.py"]
