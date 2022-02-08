import { CloudWatchLogsEvent } from 'aws-lambda';
import { connect } from 'net';
import {
  logMessage as getLogMessage
} from './parse';

const host  = process.env.logstash_host;
const port  = Number(process.env.logstash_port);
const token = process.env.token;

export interface Parameters {
  logGroup: string;
  logStream: string;
  logEvents: [CloudWatchLogsEvent];
}

const processAll = async ({ logGroup, logStream, logEvents }: Parameters) => {
  await new Promise((resolve, _) => {
    const socket = connect(port, host, () => {
      socket.setEncoding('utf8');

      for (let logEvent of logEvents) {
        try {
          let log = getLogMessage(logEvent);

          if (log) {
            const { functionVersion, functionMemorySize, sLevel, awsRegion, message, functionName } = JSON.parse(log.message);

            log.functionName       = functionName;
            log.functionVersion    = functionVersion;
            log.functionMemorySize = functionMemorySize;
            log.level              = sLevel;
            log.awsRegion          = awsRegion;
            log.name               = message;
            log.logStream          = logStream;
            log.logGroup           = logGroup;
            log.type               = "cloudwatch";
            log.token              = token;
            log.fields             = {};

            let parsedLogMessage = JSON.parse(log.message);

            // Delete metadata from 'message' field, because they're shipped to ELK in separate fields
            delete parsedLogMessage.awsRegion;
            delete parsedLogMessage.functionName;
            delete parsedLogMessage.functionVersion;
            delete parsedLogMessage.functionMemorySize;
            delete parsedLogMessage.level;
            delete parsedLogMessage.sLevel;
            delete parsedLogMessage.message;
            delete log.message;

            // After deleting metadata fields, if what remained is an empty object, send empty string to ELK
            Object.keys(parsedLogMessage).length < 1
              ? log.data = '-'
              : log.data = JSON.stringify(parsedLogMessage);

            socket.write(JSON.stringify(log) + '\n');

            console.log('Sent log to Logz.io', log);
          }
        
        } catch (e) {
          console.error(e.message);
        }
      }

      socket.end()

      resolve(null);
    });
  });
};

export default processAll;
