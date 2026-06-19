const fs = require('fs');
const file = 'src/apps/pulso/services/lotusOpenClawClient.ts';
let code = fs.readFileSync(file, 'utf8');

// Update LotusSendPayload
const payloadOld = `  contextWindow: any[];
}`;

const payloadNew = `  contextWindow: any[];
  areaRef?: string;
  secondaryAreaRefs?: string[];
  routing?: any;
}`;

code = code.replace(payloadOld, payloadNew);

// Update reqPayload inside queueRequest
const reqOld = `      status: "queued_for_openclaw" as any,
      source: payload.source,`;

const reqNew = `      status: "queued_for_openclaw" as any,
      source: payload.source,
      areaRef: payload.areaRef,
      secondaryAreaRefs: payload.secondaryAreaRefs,
      routing: payload.routing,`;

code = code.replace(reqOld, reqNew);

fs.writeFileSync(file, code);
console.log('Client updated');
