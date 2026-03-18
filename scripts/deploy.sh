PARAMS="Owner=\"$STAGE\" LogRetentionInDays=\"$LOG_RETENTION_IN_DAYS\""


sam deploy \
  --stack-name="genai-inference-evaluation-tool-$STAGE" \
  --s3-prefix="genai-inference-evaluation-tool-$STAGE" \
  --tags Project=genai-inference-evaluation-tool Owner="$STAGE" Name="genai-inference-evaluation-tool-$STAGE" \
  --parameter-overrides $PARAMS \
  --no-fail-on-empty-changeset \
  "$@"

