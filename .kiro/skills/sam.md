---
inclusion: manual
---

# AWS SAM Skill

Guidance for working with AWS SAM (Serverless Application Model) — the open-source framework for building serverless applications on AWS using CloudFormation.

## SAM Template Basics

SAM templates are CloudFormation templates with a `Transform: AWS::Serverless-2016-10-31` declaration and shorthand resource types.

### Minimal Template

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31
Description: My serverless app

Globals:
  Function:
    Timeout: 30
    Runtime: nodejs20.x
    MemorySize: 256

Resources:
  MyFunction:
    Type: AWS::Serverless::Function
    Properties:
      Handler: src/handlers/index.handler
      Events:
        Api:
          Type: HttpApi
          Properties:
            Path: /hello
            Method: GET
```

### Key Resource Types

- `AWS::Serverless::Function` — Lambda function
- `AWS::Serverless::HttpApi` — HTTP API Gateway (v2, recommended)
- `AWS::Serverless::Api` — REST API Gateway (v1)
- `AWS::Serverless::SimpleTable` — DynamoDB table
- `AWS::Serverless::LayerVersion` — Lambda layer
- `AWS::Serverless::StateMachine` — Step Functions state machine
- `AWS::Serverless::Connector` — Simplified permissions between resources

### Function Properties

```yaml
MyFunction:
  Type: AWS::Serverless::Function
  Properties:
    Handler: handler.handler
    Runtime: python3.12 # or nodejs20.x, java21, etc.
    Timeout: 900 # max 900s (15 min)
    MemorySize: 512 # MB, 128–10240
    Architectures:
      - arm64 # or x86_64
    Environment:
      Variables:
        TABLE_NAME: !Ref MyTable
    Layers:
      - !Ref MyLayer
    Policies:
      - DynamoDBCrudPolicy:
          TableName: !Ref MyTable
      - S3ReadPolicy:
          BucketName: !Ref MyBucket
    Events:
      ApiEvent:
        Type: HttpApi
        Properties:
          Path: /items
          Method: POST
      Schedule:
        Type: Schedule
        Properties:
          Schedule: rate(1 hour)
```

### Event Source Types

- `HttpApi` — HTTP API Gateway v2
- `Api` — REST API Gateway v1
- `Schedule` — EventBridge scheduled rule
- `S3` — S3 bucket notifications
- `SQS` — SQS queue trigger
- `SNS` — SNS topic subscription
- `DynamoDB` — DynamoDB Streams
- `Kinesis` — Kinesis stream
- `Cognito` — Cognito User Pool trigger

### Globals Section

```yaml
Globals:
  Function:
    Timeout: 30
    Runtime: nodejs20.x
    MemorySize: 256
    Tracing: Active
    Environment:
      Variables:
        STAGE: !Ref AWS::StackName
  HttpApi:
    CorsConfiguration:
      AllowOrigins:
        - '*'
      AllowMethods:
        - GET
        - POST
```

### SAM Policy Templates

Common shorthand policies (no need to write full IAM):

- `DynamoDBCrudPolicy` / `DynamoDBReadPolicy` — DynamoDB access
- `S3ReadPolicy` / `S3CrudPolicy` — S3 bucket access
- `SQSSendMessagePolicy` / `SQSPollerPolicy` — SQS access
- `SNSPublishMessagePolicy` — Publish to SNS
- `LambdaInvokePolicy` — Invoke another Lambda
- `StepFunctionsExecutionPolicy` — Start Step Functions execution
- `KMSDecryptPolicy` — Decrypt with KMS key
- `SSMParameterReadPolicy` — Read SSM parameters
- `SecretsManagerGetSecretValuePolicy` — Read Secrets Manager

Full list: https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-policy-templates.html

### Connectors (Simplified Permissions)

```yaml
MyConnector:
  Type: AWS::Serverless::Connector
  Properties:
    Source:
      Id: MyFunction
    Destination:
      Id: MyTable
    Permissions:
      - Read
      - Write
```

## SAM CLI Commands

### Init, Build, Deploy

```bash
sam init                          # Scaffold new project
sam build                         # Build artifacts
sam build --use-container         # Build with Docker (Linux-compatible binaries)
sam deploy --guided               # First-time deploy (creates samconfig.toml)
sam deploy                        # Subsequent deploys
sam deploy --stack-name my-app-staging --parameter-overrides Stage=staging
```

### Local Development

```bash
sam local invoke "MyFunction" -e events/event.json
sam local start-api               # Local API Gateway with hot-reload
sam local start-lambda            # Local Lambda endpoint for SDK invocations
sam local generate-event apigateway http-api-proxy
sam local generate-event s3 put
sam local generate-event sqs receive-message
```

### Debugging

```bash
sam local invoke -d 5858 "MyFunction" -e event.json
sam local start-api -d 5858
```

VS Code launch config for attaching:

```json
{
  "type": "node",
  "request": "attach",
  "name": "Attach to SAM",
  "port": 5858,
  "localRoot": "${workspaceFolder}",
  "remoteRoot": "/var/task"
}
```

### Logs, Sync, Validate

```bash
sam logs -n MyFunction --stack-name my-stack --tail
sam logs -n MyFunction --stack-name my-stack --start-time "5min ago"
sam sync --watch --stack-name my-stack    # Hot deploy (skips CFN for code changes)
sam sync --code --stack-name my-stack     # Code-only sync
sam validate --lint
sam list endpoints --stack-name my-stack
sam list resources --stack-name my-stack
sam delete --stack-name my-stack
```

## samconfig.toml

```toml
version = 0.1

[default.deploy.parameters]
stack_name = "my-app"
resolve_s3 = true
s3_prefix = "my-app"
region = "us-east-1"
capabilities = "CAPABILITY_IAM"
confirm_changeset = true

[default.build.parameters]
use_container = true

[staging.deploy.parameters]
stack_name = "my-app-staging"
parameter_overrides = "Stage=staging"
```

Use config environments: `sam deploy --config-env staging`

## Environment Variables for Local Testing

```json
{
  "MyFunction": {
    "TABLE_NAME": "local-table",
    "STAGE": "local"
  }
}
```

```bash
sam local invoke "MyFunction" -e event.json --env-vars env.json
sam local start-api --env-vars env.json
```

## Container Image Lambda Functions

Lambda supports packaging as container images (up to 10 GB) instead of zip archives.

### Dockerfiles

Node.js:

```dockerfile
FROM public.ecr.aws/lambda/nodejs:20
COPY package*.json ${LAMBDA_TASK_ROOT}/
RUN npm ci --omit=dev
COPY src/ ${LAMBDA_TASK_ROOT}/src/
CMD ["src/handlers/index.handler"]
```

Python:

```dockerfile
FROM public.ecr.aws/lambda/python:3.12
COPY requirements.txt ${LAMBDA_TASK_ROOT}/
RUN pip install -r requirements.txt --target "${LAMBDA_TASK_ROOT}"
COPY app/ ${LAMBDA_TASK_ROOT}/app/
CMD ["app.handler.handler"]
```

Custom runtime:

```dockerfile
FROM public.ecr.aws/lambda/provided:al2023
COPY bootstrap ${LAMBDA_RUNTIME_DIR}/
COPY my-app ${LAMBDA_TASK_ROOT}/
CMD ["my-app.handler"]
```

### SAM Template for Container Functions

```yaml
MyContainerFunction:
  Type: AWS::Serverless::Function
  Properties:
    PackageType: Image
    Architectures:
      - arm64
    MemorySize: 1024
    Timeout: 300
    Events:
      Api:
        Type: HttpApi
        Properties:
          Path: /process
          Method: POST
  Metadata:
    Dockerfile: Dockerfile
    DockerContext: ./src/my-function
    DockerTag: latest
```

### Build and Deploy Container Functions

```bash
sam build
sam deploy --guided --resolve-image-repos   # SAM creates ECR repo automatically
sam deploy --image-repository 123456789012.dkr.ecr.us-east-1.amazonaws.com/my-repo
```

### Lambda Web Adapter (Run Web Frameworks on Lambda)

```dockerfile
FROM public.ecr.aws/docker/library/node:20-slim
COPY --from=public.ecr.aws/awsguru/aws-lambda-web-adapter:0.8.4 /lambda-adapter /opt/extensions/
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
CMD ["node", "server.js"]
```

```yaml
WebAppFunction:
  Type: AWS::Serverless::Function
  Properties:
    PackageType: Image
    MemorySize: 512
    Environment:
      Variables:
        PORT: '8080'
        AWS_LWA_READINESS_CHECK_PATH: /health
  Metadata:
    Dockerfile: Dockerfile
    DockerContext: ./web-app
```

## ECS Fargate in SAM Templates

SAM doesn't have a `AWS::Serverless::` resource for Fargate, but SAM templates are CloudFormation — you can embed standard `AWS::ECS::*` resources alongside serverless ones. This is useful when a workload exceeds Lambda's 15-min timeout, needs persistent connections, or requires more than 10 GB memory.

### When to Use Fargate vs Lambda

- Lambda: event-driven, short-lived (up to 15 min), auto-scales to zero, pay-per-invocation
- Fargate: long-running processes, persistent services, predictable load, needs more memory/CPU, WebSocket servers

### Minimal Fargate Service in a SAM Template

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31

Resources:
  # --- VPC (or import an existing one) ---
  VPC:
    Type: AWS::EC2::VPC
    Properties:
      CidrBlock: 10.0.0.0/16
      EnableDnsSupport: true
      EnableDnsHostnames: true

  PublicSubnetA:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref VPC
      CidrBlock: 10.0.1.0/24
      AvailabilityZone: !Select [0, !GetAZs '']
      MapPublicIpOnLaunch: true

  PublicSubnetB:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref VPC
      CidrBlock: 10.0.2.0/24
      AvailabilityZone: !Select [1, !GetAZs '']
      MapPublicIpOnLaunch: true

  InternetGateway:
    Type: AWS::EC2::InternetGateway

  VPCGatewayAttachment:
    Type: AWS::EC2::VPCGatewayAttachment
    Properties:
      VpcId: !Ref VPC
      InternetGatewayId: !Ref InternetGateway

  PublicRouteTable:
    Type: AWS::EC2::RouteTable
    Properties:
      VpcId: !Ref VPC

  PublicRoute:
    Type: AWS::EC2::Route
    DependsOn: VPCGatewayAttachment
    Properties:
      RouteTableId: !Ref PublicRouteTable
      DestinationCidrBlock: 0.0.0.0/0
      GatewayId: !Ref InternetGateway

  SubnetARouteTableAssoc:
    Type: AWS::EC2::SubnetRouteTableAssociation
    Properties:
      SubnetId: !Ref PublicSubnetA
      RouteTableId: !Ref PublicRouteTable

  SubnetBRouteTableAssoc:
    Type: AWS::EC2::SubnetRouteTableAssociation
    Properties:
      SubnetId: !Ref PublicSubnetB
      RouteTableId: !Ref PublicRouteTable

  # --- ECS Cluster ---
  ECSCluster:
    Type: AWS::ECS::Cluster
    Properties:
      ClusterName: !Sub '${AWS::StackName}-cluster'

  # --- Task Execution Role (pulls images, writes logs) ---
  TaskExecutionRole:
    Type: AWS::IAM::Role
    Properties:
      AssumeRolePolicyDocument:
        Version: '2012-10-17'
        Statement:
          - Effect: Allow
            Principal:
              Service: ecs-tasks.amazonaws.com
            Action: sts:AssumeRole
      ManagedPolicyArns:
        - arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy

  # --- Task Role (permissions for your app code) ---
  TaskRole:
    Type: AWS::IAM::Role
    Properties:
      AssumeRolePolicyDocument:
        Version: '2012-10-17'
        Statement:
          - Effect: Allow
            Principal:
              Service: ecs-tasks.amazonaws.com
            Action: sts:AssumeRole

  # --- Log Group ---
  LogGroup:
    Type: AWS::Logs::LogGroup
    Properties:
      LogGroupName: !Sub '/ecs/${AWS::StackName}'
      RetentionInDays: 14

  # --- Security Group ---
  ServiceSecurityGroup:
    Type: AWS::EC2::SecurityGroup
    Properties:
      GroupDescription: Allow inbound traffic on container port
      VpcId: !Ref VPC
      SecurityGroupIngress:
        - IpProtocol: tcp
          FromPort: 8080
          ToPort: 8080
          CidrIp: 0.0.0.0/0

  # --- Task Definition ---
  TaskDefinition:
    Type: AWS::ECS::TaskDefinition
    Properties:
      Family: !Sub '${AWS::StackName}-task'
      Cpu: '512' # 0.5 vCPU
      Memory: '1024' # 1 GB
      NetworkMode: awsvpc
      RequiresCompatibilities:
        - FARGATE
      ExecutionRoleArn: !GetAtt TaskExecutionRole.Arn
      TaskRoleArn: !GetAtt TaskRole.Arn
      ContainerDefinitions:
        - Name: app
          Image: !Sub '${AWS::AccountId}.dkr.ecr.${AWS::Region}.amazonaws.com/my-app:latest'
          PortMappings:
            - ContainerPort: 8080
              Protocol: tcp
          Environment:
            - Name: STAGE
              Value: !Ref AWS::StackName
          LogConfiguration:
            LogDriver: awslogs
            Options:
              awslogs-group: !Ref LogGroup
              awslogs-region: !Ref AWS::Region
              awslogs-stream-prefix: app

  # --- Fargate Service ---
  FargateService:
    Type: AWS::ECS::Service
    Properties:
      Cluster: !Ref ECSCluster
      TaskDefinition: !Ref TaskDefinition
      DesiredCount: 2
      LaunchType: FARGATE
      NetworkConfiguration:
        AwsvpcConfiguration:
          AssignPublicIp: ENABLED
          Subnets:
            - !Ref PublicSubnetA
            - !Ref PublicSubnetB
          SecurityGroups:
            - !Ref ServiceSecurityGroup
```

### Fargate CPU/Memory Combinations

| CPU (vCPU) | Memory Options (GB)         |
| ---------- | --------------------------- |
| 0.25       | 0.5, 1, 2                   |
| 0.5        | 1, 2, 3, 4                  |
| 1          | 2, 3, 4, 5, 6, 7, 8         |
| 2          | 4–16 (in 1 GB increments)   |
| 4          | 8–30 (in 1 GB increments)   |
| 8          | 16–60 (in 4 GB increments)  |
| 16         | 32–120 (in 8 GB increments) |

### Fargate with ALB

Add an Application Load Balancer in front of the Fargate service:

```yaml
ALB:
  Type: AWS::ElasticLoadBalancingV2::LoadBalancer
  Properties:
    Scheme: internet-facing
    Subnets:
      - !Ref PublicSubnetA
      - !Ref PublicSubnetB
    SecurityGroups:
      - !Ref ALBSecurityGroup

ALBSecurityGroup:
  Type: AWS::EC2::SecurityGroup
  Properties:
    GroupDescription: Allow HTTP
    VpcId: !Ref VPC
    SecurityGroupIngress:
      - IpProtocol: tcp
        FromPort: 80
        ToPort: 80
        CidrIp: 0.0.0.0/0

TargetGroup:
  Type: AWS::ElasticLoadBalancingV2::TargetGroup
  Properties:
    Port: 8080
    Protocol: HTTP
    VpcId: !Ref VPC
    TargetType: ip
    HealthCheckPath: /health
    HealthCheckIntervalSeconds: 30

ALBListener:
  Type: AWS::ElasticLoadBalancingV2::Listener
  Properties:
    LoadBalancerArn: !Ref ALB
    Port: 80
    Protocol: HTTP
    DefaultActions:
      - Type: forward
        TargetGroupArn: !Ref TargetGroup

FargateServiceWithALB:
  Type: AWS::ECS::Service
  DependsOn: ALBListener
  Properties:
    Cluster: !Ref ECSCluster
    TaskDefinition: !Ref TaskDefinition
    DesiredCount: 2
    LaunchType: FARGATE
    NetworkConfiguration:
      AwsvpcConfiguration:
        AssignPublicIp: ENABLED
        Subnets:
          - !Ref PublicSubnetA
          - !Ref PublicSubnetB
        SecurityGroups:
          - !Ref ServiceSecurityGroup
    LoadBalancers:
      - ContainerName: app
        ContainerPort: 8080
        TargetGroupArn: !Ref TargetGroup
```

### Fargate Auto Scaling

```yaml
ScalableTarget:
  Type: AWS::ApplicationAutoScaling::ScalableTarget
  Properties:
    MaxCapacity: 10
    MinCapacity: 1
    ResourceId: !Sub 'service/${ECSCluster}/${FargateService.Name}'
    ScalableDimension: ecs:service:DesiredCount
    ServiceNamespace: ecs
    RoleARN: !Sub 'arn:aws:iam::${AWS::AccountId}:role/aws-service-role/ecs.application-autoscaling.amazonaws.com/AWSServiceRoleForApplicationAutoScaling_ECSService'

ScalingPolicy:
  Type: AWS::ApplicationAutoScaling::ScalingPolicy
  Properties:
    PolicyName: cpu-scaling
    PolicyType: TargetTrackingScaling
    ScalingTargetId: !Ref ScalableTarget
    TargetTrackingScalingPolicyConfiguration:
      PredefinedMetricSpecification:
        PredefinedMetricType: ECSServiceAverageCPUUtilization
      TargetValue: 70
      ScaleInCooldown: 300
      ScaleOutCooldown: 60
```

### Fargate Spot (Cost Savings)

Use a capacity provider strategy to mix Fargate and Fargate Spot:

```yaml
ECSCluster:
  Type: AWS::ECS::Cluster
  Properties:
    CapacityProviders:
      - FARGATE
      - FARGATE_SPOT
    DefaultCapacityProviderStrategy:
      - CapacityProvider: FARGATE
        Weight: 1
        Base: 1 # At least 1 task on regular Fargate
      - CapacityProvider: FARGATE_SPOT
        Weight: 3 # 3:1 ratio of Spot to On-Demand
```

### Lambda Triggering a Fargate Task

A common pattern — Lambda handles the API request and kicks off a long-running Fargate task:

```yaml
TriggerFunction:
  Type: AWS::Serverless::Function
  Properties:
    Handler: src/trigger.handler
    Runtime: nodejs20.x
    Environment:
      Variables:
        CLUSTER_ARN: !GetAtt ECSCluster.Arn
        TASK_DEFINITION: !Ref TaskDefinition
        SUBNET_A: !Ref PublicSubnetA
        SUBNET_B: !Ref PublicSubnetB
        SECURITY_GROUP: !Ref ServiceSecurityGroup
    Policies:
      - Version: '2012-10-17'
        Statement:
          - Effect: Allow
            Action:
              - ecs:RunTask
              - iam:PassRole
            Resource: '*'
    Events:
      Api:
        Type: HttpApi
        Properties:
          Path: /run-task
          Method: POST
```

Handler code to run a Fargate task:

```typescript
import { ECSClient, RunTaskCommand } from '@aws-sdk/client-ecs';

const ecs = new ECSClient({});

export const handler = async (event: any) => {
  const result = await ecs.send(
    new RunTaskCommand({
      cluster: process.env.CLUSTER_ARN,
      taskDefinition: process.env.TASK_DEFINITION,
      launchType: 'FARGATE',
      networkConfiguration: {
        awsvpcConfiguration: {
          assignPublicIp: 'ENABLED',
          subnets: [process.env.SUBNET_A!, process.env.SUBNET_B!],
          securityGroups: [process.env.SECURITY_GROUP!],
        },
      },
      overrides: {
        containerOverrides: [
          {
            name: 'app',
            environment: [
              { name: 'JOB_ID', value: JSON.parse(event.body).jobId },
            ],
          },
        ],
      },
    }),
  );

  return {
    statusCode: 202,
    body: JSON.stringify({ taskArn: result.tasks?.[0]?.taskArn }),
  };
};
```

## TypeScript Lambda with SAM

Use `esbuild` for fast TypeScript bundling:

```yaml
MyFunction:
  Type: AWS::Serverless::Function
  Properties:
    Handler: src/handlers/index.handler
    Runtime: nodejs20.x
    Metadata:
      BuildMethod: esbuild
      BuildProperties:
        Minify: true
        Target: es2022
        Sourcemap: true
        EntryPoints:
          - src/handlers/index.ts
        External:
          - '@aws-sdk/*'
```

## Python Lambda with SAM

SAM auto-installs `requirements.txt` during `sam build`:

```yaml
EvalFunction:
  Type: AWS::Serverless::Function
  Properties:
    Handler: handler.handler
    Runtime: python3.12
    CodeUri: src/eval/
```

Place `requirements.txt` alongside the handler. Use `sam build --use-container` for native C extensions.

## Layers

```yaml
SharedLayer:
  Type: AWS::Serverless::LayerVersion
  Properties:
    LayerName: shared-deps
    ContentUri: layers/shared/
    CompatibleRuntimes:
      - nodejs20.x
    RetentionPolicy: Delete
  Metadata:
    BuildMethod: nodejs20.x

MyFunction:
  Type: AWS::Serverless::Function
  Properties:
    Layers:
      - !Ref SharedLayer
```

## Outputs and Cross-Stack References

```yaml
Outputs:
  ApiUrl:
    Value: !Sub 'https://${ServerlessHttpApi}.execute-api.${AWS::Region}.amazonaws.com'
  FunctionArn:
    Value: !GetAtt MyFunction.Arn
    Export:
      Name: !Sub '${AWS::StackName}-FunctionArn'
```

## Common Patterns

### Function URL (no API Gateway)

```yaml
MyFunction:
  Type: AWS::Serverless::Function
  Properties:
    Handler: index.handler
    Runtime: nodejs20.x
    FunctionUrlConfig:
      AuthType: NONE
```

### DynamoDB + Function

```yaml
ItemsTable:
  Type: AWS::Serverless::SimpleTable
  Properties:
    PrimaryKey:
      Name: id
      Type: String

ItemsFunction:
  Type: AWS::Serverless::Function
  Properties:
    Handler: index.handler
    Runtime: nodejs20.x
    Environment:
      Variables:
        TABLE_NAME: !Ref ItemsTable
    Policies:
      - DynamoDBCrudPolicy:
          TableName: !Ref ItemsTable
```

### Lambda Invoking Another Lambda

```yaml
CallerFunction:
  Type: AWS::Serverless::Function
  Properties:
    Handler: caller.handler
    Runtime: nodejs20.x
    Environment:
      Variables:
        TARGET_FUNCTION: !Ref TargetFunction
    Policies:
      - LambdaInvokePolicy:
          FunctionName: !Ref TargetFunction

TargetFunction:
  Type: AWS::Serverless::Function
  Properties:
    Handler: target.handler
    Runtime: python3.12
```
