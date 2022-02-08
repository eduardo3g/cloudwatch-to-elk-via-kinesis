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
          const log = getLogMessage(logEvent);

          if (log) {
            const parsedLogMessage = JSON.parse(log.message);

            log.functionName       = JSON.stringify(parsedLogMessage.functionName);
            log.functionVersion    = parsedLogMessage.functionVersion;
            log.functionMemorySize = parsedLogMessage.functionMemorySize;
            log.level              = parsedLogMessage.sLevel;
            log.awsRegion          = parsedLogMessage.awsRegion;
            log.name               = parsedLogMessage.message;
            log.logStream          = logStream;
            log.logGroup           = logGroup;
            log.type               = "cloudwatch";
            log.token              = token;
            log.fields             = {};

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
