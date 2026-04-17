#!/bin/bash

if [ -z "$1" ]; then
  configuration_name="development"
else
  configuration_name=$1
fi

account_id=$(aws sts get-caller-identity --query Account --output text)
stack_outputs=$(sam list stack-outputs --stack-name="genai-inference-model-evaluation-tool-$STAGE" --output json)
api_endpoint=$(echo "$stack_outputs" | jq -r -c '.[] | select(.OutputKey=="ApiUrl") | .OutputValue')

aws_region=$(aws configure list | grep region | awk '{print $3}')

{
  echo "VITE_ACCOUNT_ID=$account_id"
  echo "VITE_STAGE=$STAGE"
  echo "VITE_API_URL=$api_endpoint"
  echo "VITE_AWS_REGION=$aws_region"
} > .env.$configuration_name