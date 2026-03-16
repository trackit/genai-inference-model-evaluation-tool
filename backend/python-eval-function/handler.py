import json


def handler(event, context):
    """Entry point for evaluation Lambda.
    Accepts an event payload and returns structured JSON."""
    return {
        "statusCode": 200,
        "body": json.dumps({"status": "ok", "message": "Evaluation handler ready"})
    }
