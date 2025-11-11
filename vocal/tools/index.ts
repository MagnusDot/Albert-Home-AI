import { addTool } from './add.js';
import { multipleTool } from './multiple.js';
import { soustracTool } from './soustrac.js';
import { weatherTool } from './weather.js';

export function getTools() {
  return [
    addTool,
    multipleTool,
    soustracTool,
    weatherTool
  ];
}
