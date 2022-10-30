import { Duration } from "aws-cdk-lib";
import { Table, TableProps } from "aws-cdk-lib/aws-dynamodb";
import { Role, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import { Code, Function, Runtime } from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";

export interface CRUDConstructProps {
  tableId: string;
  table: TableProps;
  lambdaPrefixId: string;
  lambdaPackage: string;
}

/**
 * A new AWS construct that creates CRUD (create, read, update, delete) functions.
 * The dynamodb table properties are required to make the new construct, and all functions
 * are linked up to the table.
 * Permissions are added for the lambdas to interact with the table.
 */
export class CRUDConstruct extends Construct {
  // The new dynamodb that is made
  private _table: Table;
  // Read function of CRUD
  private _getLambda: Function;
  // Update function of CRUD
  private _updateLambda: Function;
  // Create function of CRUD
  private _createLambda: Function;
  // Delete function of CRUD
  private _deleteLambda: Function;

  /**
   * The default construct that attaches the construct to a parent and creates
   * resources required for the CRUD functions.
   * @param scope - Parent
   * @param id - name of this brand new construct
   * @param props - Table props for dynamodb, lambda information for loading the function handlers.
   */
  constructor(scope: Construct, id: string, props: CRUDConstructProps) {
    super(scope, id);

    // Create the new dynamodb table
    this._table = new Table(this, props.tableId, {
      ...props.table,
    });

    // Create new IAM roles so the lambdas can access resources.
    const { getRole, createRole, updateRole, deleteRole } =
      this._createLambdaRoles(props.lambdaPrefixId, this._table);

    // Create the Create of CRUD lambda.
    this._createLambda = this._createLambdas(
      props.lambdaPrefixId,
      props.lambdaPackage,
      "create",
      this._table.tableName,
      createRole
    );

    // Create the Update of CRUD lambda.
    this._updateLambda = this._createLambdas(
      props.lambdaPrefixId,
      props.lambdaPackage,
      "update",
      this._table.tableName,
      updateRole
    );

    // Create the Delete of CRUD lambda.
    this._deleteLambda = this._createLambdas(
      props.lambdaPrefixId,
      props.lambdaPackage,
      "delete",
      this._table.tableName,
      deleteRole
    );

    // Create the Get of CRUD lambda.
    this._getLambda = this._createLambdas(
      props.lambdaPrefixId,
      props.lambdaPackage,
      "get",
      this._table.tableName,
      getRole
    );
  }

  /**
   * A helper function that given a path to the lambda handler's resource,
   * will create a new lambda and attach it to the table with the requested IAM role.
   * The source code will be loaded from `lambdaPackageName.fnNamePrefix_lambdaPrefixId`
   * @param lambdaPrefixId - Prefix for all lambdas, e.g. todo - CRUD functions for "todo"
   * @param lambdaPackageName - Name of the code package file name to load from
   * @param fnNamePrefix - name of the function in the lambdaPackageName that contains the code.
   * @param tableName - name of the dynamodb to interact with.
   * @param role - the role to use for the lambda.
   * @returns - the new lambda function
   */
  private _createLambdas(
    lambdaPrefixId: string,
    lambdaPackageName: string,
    fnNamePrefix: string,
    tableName: string,
    role: Role
  ) {
    const fn = new Function(this, `${fnNamePrefix}-${lambdaPrefixId}`, {
      role: role,
      functionName: `${fnNamePrefix}-${lambdaPrefixId}`,
      code: Code.fromAsset("resources"),
      runtime: Runtime.PYTHON_3_9,
      handler: `${lambdaPackageName}.${fnNamePrefix}_${lambdaPrefixId}`,
      memorySize: 128,
      timeout: Duration.seconds(30),
      environment: {
        TODO_DATABASE: tableName,
      },
    });
    return fn;
  }

  /**
   * A helper function that will create CRUD lambda's corresponding roles
   * and attach it to the requested table (gives actions on it).
   * @param lambdaPrefixId - name for the CRUDs. e.g. todo - makes everything "todo"role.
   * @param table - Provide access to this dynamodb table
   * @returns - The list of CRUD IAM roles as a dictionary.
   */
  private _createLambdaRoles(lambdaPrefixId: string, table: Table) {
    // Create an IAM role for the Read in CRUD.
    const getLambdaRole = new Role(this, `Get${lambdaPrefixId}-Role`, {
      roleName: `get-${lambdaPrefixId}-role`,
      assumedBy: new ServicePrincipal("lambda.amazonaws.com"),
      description: "Allow lambda to call dynamodb tables",
    });
    table.grantReadData(getLambdaRole);

    // Create an IAM role for the Create in CRUD.
    const createLambdaRole = new Role(this, `Create${lambdaPrefixId}-Role`, {
      roleName: `create-${lambdaPrefixId}-role`,
      assumedBy: new ServicePrincipal("lambda.amazonaws.com"),
      description: "Allow lambda to call dynamodb tables",
    });
    table.grantWriteData(createLambdaRole);

    // Create an IAM role for the Update in CRUD.
    const updateLambdaRole = new Role(this, `Update${lambdaPrefixId}-Role`, {
      roleName: `update-${lambdaPrefixId}-role`,
      assumedBy: new ServicePrincipal("lambda.amazonaws.com"),
      description: "Allow lambda to call dynamodb tables",
    });
    table.grantWriteData(updateLambdaRole);

    // Create an IAM role for the Delete in CRUD.
    const deleteLambdaRole = new Role(this, `Delete${lambdaPrefixId}-Role`, {
      roleName: `delete-${lambdaPrefixId}-role`,
      assumedBy: new ServicePrincipal("lambda.amazonaws.com"),
      description: "Allow lambda to call dynamodb tables",
    });
    table.grantWriteData(deleteLambdaRole);

    return {
      createRole: createLambdaRole,
      updateRole: updateLambdaRole,
      getRole: getLambdaRole,
      deleteRole: deleteLambdaRole,
    };
  }

  /**
   * Retrieves the Read resource in CRUD
   */
  public get GetLambda() {
    return this._getLambda;
  }

  /**
   * Retrieves the Update resource in CRUD
   */
  public get UpdateLambda() {
    return this._updateLambda;
  }

  /**
   * Retrieves the Delete resource in CRUD
   */
  public get DeleteLambda() {
    return this._deleteLambda;
  }

  /**
   * Retrieves the Create resource in CRUD
   */
  public get CreateLambda() {
    return this._createLambda;
  }
}
