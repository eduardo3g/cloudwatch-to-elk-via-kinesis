import { APIGatewayProxyEvent, APIGatewayProxyResultV2 } from "aws-lambda";
import Log from '@dazn/lambda-powertools-logger';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResultV2> => {
  Log.info('Initialized ship-logs function');

  Log.info('Received event body', JSON.parse(event.body));

  Log.info('Received event headers', event.headers);

  console.debug('The request is valid');

  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'ok', event }),
  };
};
