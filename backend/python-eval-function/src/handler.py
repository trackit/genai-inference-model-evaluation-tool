"""Evaluation tools Lambda handler.

This standalone Lambda is invoked directly by the TypeScript Lambda handlers
via the AWS SDK (@aws-sdk/client-lambda). It is NOT exposed through API Gateway.

Entry point for SAM: handler.handler
"""

import json


def handler(event, context):
    """Process an evaluation request and return a structured JSON response.

    Args:
        event: Event payload dict sent from the TypeScript Lambda via AWS SDK invoke.
        context: AWS Lambda context object.

    Returns:
        dict with statusCode (int) and body (JSON string).
    """
    return {
        "statusCode": 200,
        "body": json.dumps({"status": "ok", "message": "Evaluation handler ready"}),
    }
