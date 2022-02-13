# Scalable Clodwatch Logs log shipper with Kinesis Data Streams

Collect data from every single Cloudwatch Log Group (API Gateway, Lambda, AppSync, etc.) and stream them in real-time to an Elasticsearch cluster hosted by <a href="https://logz.io">Logz.io<a/>.
  
<img src="./.github/docs/Log%20Ingestion%20Pipeline.png" alt="Log ingestion pipeline diagram">
  
## Introduction ✨
  
Cloudwatch Logs is the core service provided by AWS to ingest and store logs, however, the experience to query those logs and set up dashboards or alerts can't be compared to Elasticsearch and Kibana.
  
## The goal 🚀
  
Having in mind that Cloudwatch Logs is not the best tool to query logs, we'd like some way to collect those logs and ship them to Elasticsearch so we can benefit from the powerful queries using Kibana. The point is, this log synchronization should be 🔥 <b>blazing fast</b> 🔥.
  
## How to achieve that 🤔
  
Since all of our logs (API Gateway, Lambda, etc.) are ingested by Cloudwatch Logs, we can take advantage of log group Subscription Filters. <br />
  
Subscription Filters allow you to subscribe to a real-time stream of log events and have them delivered to a specific destination. The current supported destinations are Kinesis Data Streams, Kinesis Firehose Delivery Stream and Lambda. <br />
  
Here are some key-points that you should consider when choosing the log group's Subscription Filter destination:
  
1. <b>Lambda</b> - have in mind that Cloudwatch is an async event source that triggers a Lambda execution. In other words, you'll increase the number of concurrent Lambda executions when the logs ingested by Cloudwatch increases. Your AWS account by default has a soft limit of 1000 concurrent executions per region, so you don't want to share a lot of concurrent executions of business critical functions with a log shipping function.
  
2. <b>Kinesis Firehose (Delivery Stream)</b> - this is a powerful service to ingest data to a series of destinations (S3, Elasticsearch, HTTP endpoint, etc.). The only problem with this approach is that Firehose has a minimum batching window of 1 minute. If you're not tolerant to delays on visualizing your logs, Firehose is not the best option for you.
  
3. <b>Kinesis Data Streams</b> - Kinesis is a service divided in a few modules, and Data Streams is one of them. Differently from Firehose, you can use a Lambda function to consume messages from the stream and forward them to the destination of your choice via HTTP calls, for example to Logz.io (hosted ELK), Splunk or many others. You can specify a number of shards to limit Lambda concurrent executions (1 shard = 1 concurrent execution) or work on demand by specifying this in the stream details. This approach is prefered over Firehose if you need to see your logs immediatly after they've been ingested by Cloudwatch Logs and avoid losing them in case the downstream system is out, since Kinesis retains the messages by specifying the retention period in hours.
  
In this solution I decided to follow the third approach: ship logs from Cloudwatch Log Groups to a Kinesis Data Stream (On Demand) via Subscription Filter.

# Tech stack 👨🏽‍🔧
- Serverless Framework
- Node.js / Typescript
- AWS Kinesis Data Streams
- AWS Lambda
- AWS Cloudwatch Logs
- AWS SSM Parameter Store
- Elasticsearch (Logz.io)

## Requirements 🧰
- Serverless Framework v2 globally installed in your workstation
  - Serverless just released v3 on Feb/2022, but this demo is not using it yet
- Node.js (14.x)
- NPM (Node Package Manager)
- AWS profile with administrator access configured via AWS CLI (required to deploy your stack later)

## Set up ⚙️

### Log Group subscription filters 

Since all the log groups should be subscribed to our Kinesis Data Stream, this setup should be applied in the platform-level, not in every single project that your squad develops. <br />

You can read more about this topic from Yan Cui's article <i>"<a href="https://theburningmonk.com/2019/10/where-serverless-plugin-stops-and-platform-starts/">Where Serverless plugin stops and platform starts</a>"</i>.

There's a pretty easy way to subscribe your existing and new Cloudwatch log groups to a Kinesis Stream. <a href="https://github.com/lumigo-io/SAR-Logging/tree/master/packages/cloudwatch-logs-auto-subscribe">This SAR</a> created by <a href="https://lumigo.io">Lumigo.io</a> deploys a Cloudformation Stack in your AWS account that automates that. You'll specify your Kinesis Data Stream ARN as the subscription filter destination. <br />

<b>IMPORTANT:</b> I highly recommend reading the SAR documentation before dpeloying it to your account, specially if you're working on a production environment. One of them is setting ```OverrideManualConfigs``` to ```true```. That will keep existing subscription filters from your log groups if your already have one. Cloudwatch supports more than one subscription filter per log group nowadays.

## Log Group retention

By default all the Log Groups are configured to never expire. That's because AWS will not discard your logs unless you tell them to. There's <a href="https://serverlessrepo.aws.amazon.com/#!/applications/arn:aws:serverlessrepo:us-east-1:374852340823:applications~auto-set-log-group-retention">another SAR</a> to configure the retention period in days for all the log groups from your account. <br />

I usually set up a 7-days retention period for the log groups, since the logs will be streamed to another log aggregation software (Elasticsearch, Splunk, Datadog, etc.). There's no need to keep them in Cloudwatch for too long after they've already been shipped.

## Elasticsearch

Like the introduction section says, the logs will be streamed to <a href="https://logz.io">Logz.io</a>, which is a fully managed Elasticsearch solution. Just create an account and grab your data shipping token. It'll be securely stored on AWS SSM (Systems Manager) Parameter Store.

## SSM Parameter Store

Open the Systems Manager in the AWS console, and create a new parameter in the Parameter Store. The type should be ```string``` and the name ```/logz-io/data-shipping-token```. Paste the token you copied from the Logz.io console. <br />

Your could encrypt this key with <a href="https://aws.amazon.com/kms/">AWS KMS</a>, but let's leave it like this to keep it simple in the demo.

## Deploy ☁️

1. Install the project dependencies.
```
npm install
```

2. Make sure that you have already created the key in the SSM Parameter Store with your Logz.io data shipping token.

3. Deploy the stack using the Serverless Framework. It'll create a ```dev``` stack on CloudFormation.

```
serverless deploy
```

4. Open your AWS account and select the Kinesis service. Get the data stream ```arn```.

5. Deploy the <a href="https://serverlessrepo.aws.amazon.com/applications/arn:aws:serverlessrepo:us-east-1:374852340823:applications~auto-subscribe-log-group-to-arn">SAR</a> that automatically creates subscription filters to the recently created Kinesis Data Stream. Use the ```arn``` from the step 4. Do not forget to read the documentation before deploying it to your account.

6. Deploy the second <a href="https://serverlessrepo.aws.amazon.com/applications/arn:aws:serverlessrepo:us-east-1:374852340823:applications~auto-set-log-group-retention">SAR</a> to update the log groups retention policy.

7. Open Cloudwatch Logs > Log Groups and make sure that your see a Subscription Filter named ```ship-logs``` (if you chose the default name when you deployed the SAR from step 5) associated with all your log groups. Also, make sure the retention of your log groups are set to 7 days or whatever the retention period you chose.

8. Remove the subscription filter from the Lambda function that ships logs to ELK. The log group is from a function called ```poc-firehose-to-elk-ship-logs-to-elk```. That's because you don't want your to ship logs to ELK from this log shipping function.

## Next steps ⏭️

- Mask sensitive fields - there will be times that developers will accidentally log sensitive fields (e.g: bearer tokens, api keys, etc.). It'd be ideal to have a list of pre-defined sensitive field names and mask them in case it is present in the log message.

- Deploy this log aggregator stack to a separate AWS account. That way it'll not consume Lambda concurrent executions from other business-critical functions. Remember that your account has a soft limit of 1000 concurrent executions per region and you can increase that by opening a ticket to AWS.

- This system will fail at some point in the future. Ship logs to an SQS dead-letter queue if the poisoned message fails to be processed.
