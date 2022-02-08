const functionName = (logGroup) => {
  return logGroup.split('/').reverse()[0];
};

const lambdaVersion = (logStream) => {
  let start = logStream.indexOf('[');
  let end = logStream.indexOf(']');
  return logStream.substring(start+1, end);
};

const logMessage = (logEvent): any => {
  if (logEvent.message.startsWith('START RequestId') ||
      logEvent.message.startsWith('END RequestId') ||
      logEvent.message.startsWith('REPORT RequestId')) {
    return null;
  }

  const parts        = logEvent.message.split('\t');
  const timestamp    = parts[0];
  const requestId    = parts[1];
  const level        = parts[2].toLowerCase();
  const message      = parts[3].replace('\n', '');

  return {
    '@timestamp': new Date(timestamp),
    level,
    message,
    requestId,
  };
};

export {
  functionName,
  lambdaVersion,
  logMessage,
};