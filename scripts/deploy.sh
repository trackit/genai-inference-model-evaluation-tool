PARAMS="Owner=\"$STAGE\" LogRetentionInDays=\"$LOG_RETENTION_IN_DAYS\" CodeSendSESSourceEmailAddress=\"$CODE_SEND_SES_SOURCE_EMAIL_ADDRESS\""


sam deploy \
  --stack-name="genai-inference-model-evaluation-tool-$STAGE" \
  --s3-prefix="genai-inference-model-evaluation-tool-$STAGE" \
  --region="${AWS_REGION}" \
  --resolve-s3 \
  --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND CAPABILITY_NAMED_IAM \
  --tags \
    Name="GenAI Inference Model Evaluation Tool Stack" \
    Project="GenAI Inference Model Evaluation Tool" \
    Owner="$STAGE" \
  --parameter-overrides $PARAMS \
  --no-fail-on-empty-changeset \
  "$@"

