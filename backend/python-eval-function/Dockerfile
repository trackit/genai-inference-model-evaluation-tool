FROM --platform=linux/amd64 python:3.11 AS builder

# RUN microdnf install -y gcc g++ make git && \
#     microdnf clean all

RUN pip install --upgrade pip

COPY requirements.txt .

RUN pip install \
    -r requirements.txt \
    -t /install \
    --no-cache-dir

FROM --platform=linux/amd64 public.ecr.aws/lambda/python:3.11

COPY --from=builder /install ${LAMBDA_TASK_ROOT}
COPY src/ ${LAMBDA_TASK_ROOT}/

CMD ["handler.handler"]
