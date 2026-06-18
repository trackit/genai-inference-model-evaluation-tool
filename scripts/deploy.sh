PARAMS="Owner=\"$STAGE\" LogRetentionInDays=\"$LOG_RETENTION_IN_DAYS\" CodeSendSESSourceEmailAddress=\"$CODE_SEND_SES_SOURCE_EMAIL_ADDRESS\""


sam deploy \
  --config-env "$STAGE" \
  --parameter-overrides $PARAMS \
  --no-fail-on-empty-changeset \
  "$@"

