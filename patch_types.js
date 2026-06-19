const fs = require('fs');
const file = 'src/apps/pulso/types/pulso.types.ts';
let code = fs.readFileSync(file, 'utf8');

// Update Area
const areaOld = `export interface Area extends BaseEntity {
  type: 'business' | 'personal' | 'family' | 'school' | 'infrastructure' | 'creative' | 'financial' | 'health' | 'land' | 'hybrid';
  importance: Priority;
  riskSummary?: string;
  nextReviewAt?: Date;
}`;

const areaNew = `export interface Area extends BaseEntity {
  type: 'business' | 'personal' | 'family' | 'school' | 'infrastructure' | 'creative' | 'financial' | 'health' | 'land' | 'hybrid';
  importance: Priority;
  riskSummary?: string;
  nextReviewAt?: Date;
  aliases?: string[];
  keywords?: string[];
  contextHints?: string[];
  defaultAgentId?: string;
  notionAreaUrl?: string;
  visibility?: 'private' | 'shared';
}`;

code = code.replace(areaOld, areaNew);

// Update PulsoRequest
const reqOld = `  projectRef?: string | null;
  sourceRef?: string | null;
  personRef?: string | null;
  requestedBy: string;`;

const reqNew = `  projectRef?: string | null;
  sourceRef?: string | null;
  personRef?: string | null;
  secondaryAreaRefs?: string[];
  routing?: {
    rawInput?: string;
    cleanInput?: string;
    sessionTarget?: string;
    secondaryTopics?: string[];
    intentType?: string;
    shouldSendToLotus?: boolean;
    shouldCreateSideNotes?: boolean;
    contextHints?: string[];
    routerVersion?: string;
    confidence?: number;
  };
  requestedBy: string;`;

code = code.replace(reqOld, reqNew);

fs.writeFileSync(file, code);
console.log('Types updated');
