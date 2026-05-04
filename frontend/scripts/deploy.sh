#!/usr/bash

stack_outputs=$(sam list stack-outputs --stack-name="genai-inference-model-evaluation-tool-$STAGE" --output json)
bucket=$(echo "$stack_outputs" | jq -r -c '.[] | select(.OutputKey=="FrontendBucketName") | .OutputValue')
distribution_id=$(echo "$stack_outputs" | jq -r -c '.[] | select(.OutputKey=="CloudFrontDistributionId") | .OutputValue')

aws s3 sync ./dist/ "s3://${bucket}/" --delete
aws cloudfront create-invalidation --distribution-id "${distribution_id}" --paths "/*" --no-cli-pager