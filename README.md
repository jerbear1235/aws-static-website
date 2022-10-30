# Welcome to your CDK TypeScript project

This is a static website CDK package to use for deploying your static website to the web.

The `cdk.json` file tells the CDK Toolkit how to execute your app.

## Manual Steps required

- Create a new Route 53 record. Easier to control your own route 53 via the AWS console and setup a domain name.
- Update the assets bucket name
- `bin/static_website.ts` process.env.CDK_DEFAULT_ACCOUNT is set to your credentials env variable. make sure to login to AWS via console.
- `bin/static_website.ts` process.env.CDK_DEFAULT_REGION is set to your credentials env variable. make sure to login to AWS via console.
- `lib/static_website-stack.ts` <enter domain name> replace these with the url of your domain. e.g. www.google.com
- `lib/static_website-stack.ts` <enter s3 bucket name> replace these with the name of your s3 bucket. e.g. static-website-bucket

## Useful commands

- `npm run build` compile typescript to js
- `npm run watch` watch for changes and compile
- `npm run test` perform the jest unit tests
- `cdk deploy` deploy this stack to your default AWS account/region
- `cdk diff` compare deployed stack with current state
- `cdk synth` emits the synthesized CloudFormation template

## Resources folder

- contains the python lambda CRUD handlers to run apis and interact with the database.
- get_todos retrieve the list of todos for the user
- update_todos update a requested todo by id
- delete_todos delete a requested todo by id
- create_todos create a requested todo

## AWS Resources Created.

- `StaticWebsite-Cert` An ACM certificate required for HTTPS.
- `RestApiG8WayLambda` A Rest API Gateway Endpoint containing the resources and methods for all TODO methods.
- `TODOS-CRUD` The Construct containing a list of lambdas for todo crud functions
- `demo-static-assets-<name>` The s3 bucket created that you can use to host a static website application.
- `StaticWebsiteLoggingBucket` The log bucket for access via cloudfront
- `OriginAccessIdentity` The s3 policy used for cloudfront to access the bucket
- `Static-Website-Distribution` Cloudfront Distribution to route assets to s3 bucket or api gateway
- `CloudFrontAliasRecord` An alias to setup route 53 to point to the cloudfront distribution
