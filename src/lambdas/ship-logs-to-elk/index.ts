import { KinesisStreamEvent, KinesisStreamRecord } from 'aws-lambda';
import { gunzipSync } from 'zlib';
import processAll from './lib';

const parsePayload = (record: KinesisStreamRecord) => {
  const payload = new Buffer(record.kinesis.data, 'base64');
  const json = (gunzipSync(payload)).toString('utf-8');
  return JSON.parse(json);
};

const getRecords = (event: KinesisStreamEvent) => event.Records.map(parsePayload);

export const handler = async (event: KinesisStreamEvent): Promise<boolean> => {
  try {
    const records = getRecords(event);
    console.log('Decoded records', records);

    for (let { logGroup, logStream, logEvents } of records) {
      await processAll({ logGroup, logStream, logEvents });
    }

    return true;
  } catch (e) {
    console.error(e);
    return false
  }
};