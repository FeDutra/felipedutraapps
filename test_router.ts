import { routeInputToArea } from './src/lib/pulso/AreaRouter';
import { candidateAreas } from './src/apps/pulso/scripts/seedAreas';

const tests = [
  "preciso comprar cimento pra obra",
  "vamos organizar a semana das meninas",
  "tenho que ver pressão e tireoide",
  "vamos falar do motor da OpenClaw",
  "preciso ver uma pendência da MODÚ",
  "o Rodrigo mandou mensagem sobre o PDF"
];

tests.forEach(t => {
  const res = routeInputToArea(t, candidateAreas as any[]);
  console.log('[TEST] "' + t + '" -> ' + (res.areaRef || 'NONE'));
});
