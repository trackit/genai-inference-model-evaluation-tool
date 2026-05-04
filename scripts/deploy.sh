PARAMS="Owner=\"$STAGE\" LogRetentionInDays=\"$LOG_RETENTION_IN_DAYS\""


sam deploy \
  --config-env "$STAGE" \
  --parameter-overrides $PARAMS \
  --no-fail-on-empty-changeset \
  "$@"

