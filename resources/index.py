import os
import json
import boto3
import uuid
from boto3.dynamodb.conditions import Key
from boto3.dynamodb.conditions import Attr
import hashlib

dynamodb_client = boto3.resource('dynamodb', region_name='us-east-1')


def get_todos(event, context):
    """
    Inputs:
    {
        queryStringParameters: {
            type: <str> - not_started, in_progress, or done
        },
        headers: {
            user: <str> the name of the user to get the todos for
        }
    }
    Outputs:
    {
        'isBase64Encoded': False,
        'statusCode': 200, or 500 on failure
        'body': {
            'items': Todo item list - parsed as json and sent to client.
        }
    }
    Environment Variables:
        - TODO_DATABASE sent from lambda.  The name of the dynamodb table to query
    Descripition:
        get_todos retrieves the list of todos from the database and returns the result
        as a list of items.
    """
    table_name = os.environ['TODO_DATABASE']
    table = dynamodb_client.Table(table_name)
    event_body = json.loads(event['queryStringParameters']) if type(event['queryStringParameters']) is str else event['queryStringParameters']
    try:
        response = table.query(
            KeyConditionExpression=Key('user_id').eq(event['headers']['user']),
            FilterExpression=Attr('type').eq(event_body['type'])
        )
    except BaseException as e:
        print(e)
        return {
            'isBase64Encoded': False,
            'statusCode': 500,
            'body': json.dumps({
                'message': 'An unknown error occurred'
            })
        }
    return {
        'isBase64Encoded': False,
        'statusCode': 200,
        'body': json.dumps({
            'items': response['Items'],
        })
    }


def create_todos(event, context):
    """
    Inputs:
    {
        body: {
            body: <str> - The contents of the todo item
            title: <str> - The title of the todo item
        },
        headers: {
            user: <str> the name of the user to add a todo to
        }
    }
    Outputs:
    {
        'isBase64Encoded': False,
        'statusCode': 200, or 500 on failure
        'body': {
            type: <str> - not_started, in_progress, or done
            body: <str> - The contents of the todo item
            title: <str> - The title of the todo item
            id: <str> - A uuid created for the item
        }
    }
    Environment Variables:
        - TODO_DATABASE sent from lambda.  The name of the dynamodb table to add a new item.
    Description:
        create_todos - adds the newly created todo item to dynamodb.
    """
    table_name = os.environ['TODO_DATABASE']
    table = dynamodb_client.Table(table_name)
    todo_id = str(uuid.uuid4())
    event_body = json.loads(event['body']) if type(event['body']) is str else event['body']
    try:
        response = table.put_item(
            Item={
                'user_id': event['headers']['user'],
                'id': todo_id,
                'body': event_body['body'],
                'title': event_body['title'],
                'type': 'not_started',
            }
        )
    except BaseException as e:
        print(e)
        return {
            'isBase64Encoded': False,
            'statusCode': 500,
            'body': json.dumps({
                'message': 'An unknown error occurred'
            })
        }
    return {
        'isBase64Encoded': False,
        'statusCode': 200,
        'body': json.dumps({
            'attributes': {
                'id': todo_id,
                'body': event_body['body'],
                'title': event_body['title'],
                'type': 'not_started',
            },
        })
    }


def update_todos(event, context):
    """
    Inputs:
    {
        body: {
            type: <str> - not_started, in_progress, or done
            id: <str> - the uuid of the item to update
        },
        headers: {
            user: <str> the name of the user to update a todo for
        }
    }
    Outputs:
    {
        'isBase64Encoded': False,
        'statusCode': 200, or 500 on failure
        'body': {
            type: <str> - not_started, in_progress, or done
            body: <str> - The contents of the todo item
            title: <str> - The title of the todo item
            id: <str> - A uuid created for the item
        }
    }
    Environment Variables:
        - TODO_DATABASE sent from lambda.  The name of the dynamodb table to update a new item for.
    Description:
        update_todos - updates the status of a requested todo
    """
    table_name = os.environ['TODO_DATABASE']
    table = dynamodb_client.Table(table_name)
    event_body = json.loads(event['body']) if type(event['body']) is str else event['body']
    try:
        response = table.update_item(
            Key={
                'user_id':  event['headers']['user'],
                'id': event_body['id'],
            },
            ExpressionAttributeNames={
                '#T': 'type',
            },
            ExpressionAttributeValues={
                ':t': event_body['type'],
            },
            UpdateExpression='SET #T = :t',
        )
    except BaseException as e:
        print(e)
        return {
            'isBase64Encoded': False,
            'statusCode': 500,
            'body': json.dumps({
                'message': 'An unknown error occurred'
            })
        }
    return {
        'isBase64Encoded': False,
        'statusCode': 200,
        'body': json.dumps({
            'attributes': {
                'id': event_body['id'],
                'type': event_body['type'],
            }
        })
    }


def delete_todos(event, context):
    """
    Inputs:
    {
        body: {
            id: <str> - the uuid of the item to delete
        },
        headers: {
            user: <str> the name of the user to delete a todo from
        }
    }
    Outputs:
    {
        'isBase64Encoded': False,
        'statusCode': 200, or 500 on failure
        'body': {
            type: <str> - not_started, in_progress, or done
            body: <str> - The contents of the todo item
            title: <str> - The title of the todo item
            id: <str> - A uuid created for the item
        }
    }
    Environment Variables:
        - TODO_DATABASE sent from lambda.  The name of the dynamodb table to delete an item from.
    Description:
        delete_todos - delets the requested todo by id
    """
    table_name = os.environ['TODO_DATABASE']
    table = dynamodb_client.Table(table_name)
    event_body = json.loads(event['body']) if type(event['body']) is str else event['body']
    try:
        response = table.delete_item(
            Key={
                'user_id': event['headers']['user'],
                'id': event_body['id'],
            },
        )
    except BaseException as e:
        print(e)
        return {
            'isBase64Encoded': False,
            'statusCode': 500,
            'body': json.dumps({
                'message': 'An unknown error occurred'
            })
        }
    return {
        'isBase64Encoded': False,
        'statusCode': 200,
        'body': json.dumps({
            'attributes': {
                'id': event_body['id']
            }
        })
    }
