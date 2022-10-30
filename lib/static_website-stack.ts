import * as cdk from "aws-cdk-lib";
import { Duration, RemovalPolicy } from "aws-cdk-lib";
import { AuthorizationType, SecurityPolicy } from "aws-cdk-lib/aws-apigateway";
import {
  Certificate,
  CertificateValidation,
} from "aws-cdk-lib/aws-certificatemanager";
import {
  CloudFrontAllowedCachedMethods,
  CloudFrontAllowedMethods,
  CloudFrontWebDistribution,
  OriginAccessIdentity,
  OriginProtocolPolicy,
  SecurityPolicyProtocol,
  ViewerCertificate,
  ViewerProtocolPolicy,
} from "aws-cdk-lib/aws-cloudfront";
import { AttributeType, BillingMode } from "aws-cdk-lib/aws-dynamodb";
import { Function } from "aws-cdk-lib/aws-lambda";
import { ARecord, HostedZone, RecordTarget } from "aws-cdk-lib/aws-route53";
import { CloudFrontTarget } from "aws-cdk-lib/aws-route53-targets";
import {
  BlockPublicAccess,
  Bucket,
  BucketEncryption,
} from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";
import { ApiGatewayLambdaConstruct } from "./api-gateway-lambda-construct";
import { CRUDConstruct } from "./crud-construct";

/**
 * The main static website resource stack that deploys all of the
 * resources required to make a static website application.
 * The static website applications comes with a backend dynamodb database linked
 * via lambdas created in the resources folder.
 * The frontend is hooked up via cloudfront, api gateway, and s3.
 * Dependencies:
 *   YOU MUST CREATE A ROUTE 53 record and import it here.
 *   Change all occurrences of <enter domain name> to the name of the registered domain.
 *   Change all occurrences of <enter s3 bucket name> to the unique name of the s3 bucket you want to make.
 */
export class StaticWebsiteStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // This imports the route 53 record made manually that registers your domain name.
    const hostedZone = HostedZone.fromLookup(
      this,
      "Static-Website-HostedZone",
      {
        domainName: "<enter domain name>",
      }
    );

    // Create the ACM used for HTTPS.
    const cert = new Certificate(this, "StaticWebsite-Cert", {
      domainName: "<enter domain name>",
      validation: CertificateValidation.fromDns(hostedZone),
    });

    // Create the API gateway stack used to hook up lambda resources via apis.
    const restApi = new ApiGatewayLambdaConstruct(this, "RestApiG8WayLambda", {
      apiId: "static-website",
      region: this.region,
      urlSuffix: this.urlSuffix,
      restApiProps: {
        restApiName: "StaticWebsiteAPI",
        description: "This is an api for testing static website apis",
        domainName: {
          domainName: "<enter domain name>",
          certificate: cert,
          securityPolicy: SecurityPolicy.TLS_1_2,
        },
        deployOptions: {
          stageName: "prod",
        },
        defaultMethodOptions: {
          authorizationType: AuthorizationType.NONE,
        },
        endpointExportName: "StaticWebsiteAPI",
      },
    });

    // Our custom crud construct that makes CRUD functions in lambdas
    // and hooks them up to a new dynamodb table.
    const todosCRUD = new CRUDConstruct(this, "TODOS-CRUD", {
      tableId: "Todos-Table",
      table: {
        partitionKey: { name: "user_id", type: AttributeType.STRING },
        sortKey: { name: "id", type: AttributeType.STRING },
        billingMode: BillingMode.PAY_PER_REQUEST,
        tableName: "todos-table",
        removalPolicy: RemovalPolicy.DESTROY,
      },
      lambdaPrefixId: "todos",
      lambdaPackage: "index",
    });

    // Link up the list of CRUD functions made to our api gateway
    // as new resources with a path.
    const lambdaApis: {
      name: string;
      fn: Function;
      type: "GET" | "POST" | "PUT" | "DELETE";
    }[] = [
      { name: "getTodos", fn: todosCRUD.GetLambda, type: "GET" },
      { name: "createTodo", fn: todosCRUD.CreateLambda, type: "POST" },
      { name: "updateTodo", fn: todosCRUD.UpdateLambda, type: "PUT" },
      { name: "deleteTodo", fn: todosCRUD.DeleteLambda, type: "DELETE" },
    ];
    lambdaApis.forEach((lambda) => restApi.addLambdaIntegration(lambda));

    // S3 Bucket to hold the index.html and all other frontend assets.
    const staticAssetsBucket = new Bucket(this, "<enter s3 bucket name>", {
      versioned: false,
      encryption: BucketEncryption.S3_MANAGED,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      bucketName: "<enter s3 bucket name>",
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // Log access in cloudfront.
    const loggingBucket = new Bucket(this, "StaticWebsiteLoggingBucket", {
      encryption: BucketEncryption.S3_MANAGED,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // Allow cloudfront access to our s3 buckets.
    const accessIdentity = new OriginAccessIdentity(
      this,
      "OriginAccessIdentity",
      {
        comment: `Read access to cloudfront for ${staticAssetsBucket.bucketArn}`,
      }
    );

    // These route behaviors in cloudfront to the relevant AWS resources
    // /api/* - Routes to the api gateway that handles routing to the correct lambda function.
    // Default (*) - All other routes in the website go back to the s3 bucket
    //   that contains all static assets.
    const originsAndBehavior: cdk.aws_cloudfront.SourceConfiguration[] = [
      {
        customOriginSource: {
          domainName: restApi.ApiEndpoint,
          originPath: `/${restApi.StageName}`,
          originProtocolPolicy: OriginProtocolPolicy.HTTPS_ONLY,
        },
        behaviors: [
          {
            pathPattern: "/api/*",
            allowedMethods: CloudFrontAllowedMethods.ALL,
            cachedMethods: CloudFrontAllowedCachedMethods.GET_HEAD_OPTIONS,
            defaultTtl: Duration.minutes(0),
            forwardedValues: {
              queryString: true,
              cookies: {
                forward: "none",
              },
              headers: [
                "Authorization",
                "user",
                "x-forwarded-user",
                "Accept",
                "Referer",
                "Content-Type",
                "Access-Control-Request-Headers",
                "Access-Control-Request-Method",
                "Origin",
              ],
            },
          },
        ],
      },
      {
        s3OriginSource: {
          s3BucketSource: staticAssetsBucket,
          originAccessIdentity: accessIdentity,
        },
        behaviors: [
          {
            isDefaultBehavior: true,
            allowedMethods: CloudFrontAllowedMethods.ALL,
            maxTtl: Duration.minutes(5),
            defaultTtl: Duration.minutes(3),
            forwardedValues: {
              queryString: true,
              cookies: {
                forward: "all",
              },
            },
          },
        ],
      },
    ];

    // Create the new distribution for our website with all behaviors and origins.
    const distribution = new CloudFrontWebDistribution(
      this,
      "Static-Website-Distribution",
      {
        originConfigs: originsAndBehavior,
        defaultRootObject: "index.html",
        errorConfigurations: [
          {
            errorCode: 404,
            responseCode: 200,
            responsePagePath: "/index.html",
          },
          {
            errorCode: 403,
            responseCode: 200,
            responsePagePath: "/index.html",
          },
        ],
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        comment: "CloudFront distribution to the static website",
        viewerCertificate: ViewerCertificate.fromAcmCertificate(cert, {
          aliases: ["<enter domain name>"],
          securityPolicy: SecurityPolicyProtocol.TLS_V1_2_2021,
        }),
        loggingConfig: {
          bucket: loggingBucket,
          includeCookies: false,
          prefix: "static-website-cf-logs-",
        },
      }
    );

    // Link Route 53 to cloudfront
    new ARecord(this, "CloudFrontAliasRecord", {
      zone: hostedZone,
      recordName: "<enter domain name>",
      target: RecordTarget.fromAlias(new CloudFrontTarget(distribution)),
    });
  }
}
