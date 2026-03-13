FROM --platform=linux/amd64 amazonlinux:2023 AS builder

RUN dnf install -y gcc gcc-c++ make cmake python3.11 python3.11-devel && \
    dnf clean all

RUN curl -O https://bootstrap.pypa.io/get-pip.py && python3.11 get-pip.py

COPY requirements.txt .
RUN pip3.11 install --no-cache-dir -r requirements.txt -t /install

# Use slim Lambda runtime image for final stage
FROM --platform=linux/amd64 public.ecr.aws/lambda/python:3.11

COPY --from=builder /install ${LAMBDA_TASK_ROOT}
COPY src/ ${LAMBDA_TASK_ROOT}/

CMD ["handler.handler"]