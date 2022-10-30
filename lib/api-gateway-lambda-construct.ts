import {
  LambdaIntegration,
  RestApi,
  RestApiProps,
} from "aws-cdk-lib/aws-apigateway";
import { Function } from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";

export interface CRUDConstructProps {
  apiId: string;
  restApiProps: RestApiProps;
  urlSuffix: string;
  region: string;
}

/**
 * A construct to create a Api Gateway and provide a method to
 * attach resources to the API Gateway.
 */
export class ApiGatewayLambdaConstruct extends Construct {
  private _apiEndpoint: RestApi;
  private _urlSuffix: string;
  private _region: string;

  /**
   * The default construct that will create the API Gateway resource
   * and build the API gateway url to reference
   * @param scope
   * @param id
   * @param props - URL properties.
   */
  constructor(scope: Construct, id: string, props: CRUDConstructProps) {
    super(scope, id);
    // what our url should end in.  e.g. /api/v1/
    this._urlSuffix = props.urlSuffix;
    // where API gateway is deployed.
    this._region = props.region;
    // Create the new Rest API resource.
    this._apiEndpoint = new RestApi(this, "static-website-api", {
      ...props.restApiProps,
    });
  }

  /**
   * Builds the API URL api gateway makes so you can attach the API Gateway resource
   * to other AWS constructs (Cloudfront).
   */
  public get ApiEndpoint() {
    return `${this._apiEndpoint.restApiId}.execute-api.${this._region}.${this._urlSuffix}`;
  }

  /**
   * Stage where API Gateway is deployed.  Default is "prod"
   */
  public get StageName() {
    return this._apiEndpoint.deploymentStage.stageName;
  }

  /**
   * Create a new resource and method for the requested lambda.
   * @param lambda lambda to attach
   *   name - name of the lambda
   *   fn - The Lambda Function resource
   *   type - The API Type to add the resource under.
   */
  public addLambdaIntegration(lambda: {
    name: string;
    fn: Function;
    type: "GET" | "POST" | "PUT" | "DELETE";
  }) {
    this._apiEndpoint.root.resourceForPath(`/api/${lambda.name}`).addMethod(
      lambda.type,
      new LambdaIntegration(lambda.fn, {
        requestTemplates: { "application/json": '{"statusCode": "200"' },
      })
    );
  }
}
