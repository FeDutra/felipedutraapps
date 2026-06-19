const fs = require('fs');
const file = 'src/apps/pulso/pages/LivePage.tsx';
let code = fs.readFileSync(file, 'utf8');

// 1. Add import
if (!code.includes('routeInputToArea')) {
  code = code.replace(
    "import { lotusOpenClawClient } from '../services/lotusOpenClawClient';",
    "import { lotusOpenClawClient } from '../services/lotusOpenClawClient';\nimport { routeInputToArea } from '../../../lib/pulso/AreaRouter';"
  );
}

// 2. Call router in handleSendMessage
const routerLogic = `      const reqId = \`req_\${Date.now()}_\${Math.random().toString(36).substring(7)}\`;
      
      // Routing
      const routeResult = routeInputToArea(rawMsg, state?.allAreas || [], {
        currentRoute: typeof window !== 'undefined' ? window.location.pathname : '/pulso/live'
      });
      
      const lotusPayload: any = {`;

code = code.replace(
  `      const reqId = \`req_\${Date.now()}_\${Math.random().toString(36).substring(7)}\`;
      const lotusPayload = {`,
  routerLogic
);

// 3. Inject areaRef and routing to lotusPayload
const payloadUpdate = `        contextWindow: []
      };
      
      if (routeResult.areaRef) lotusPayload.areaRef = routeResult.areaRef;
      if (routeResult.routing) lotusPayload.routing = routeResult.routing;
      if (routeResult.routing.secondaryTopics) lotusPayload.secondaryAreaRefs = routeResult.routing.secondaryTopics;`;

code = code.replace(
  `        contextWindow: []
      };`,
  payloadUpdate
);

fs.writeFileSync(file, code);
console.log('LivePage updated');
