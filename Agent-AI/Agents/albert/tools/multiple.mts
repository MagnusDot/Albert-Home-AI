import { tool } from "@langchain/core/tools";
import { z } from "zod";

export const multiple = tool(
  async ({ a, b }) => {
    return a * b;
  },
  {
    name: "multiple",
    description: "Multiplie deux nombres.",
    schema: z.object({
      a: z.number().describe("Le premier nombre à Multiplier"),
      b: z.number().describe("Le deuxième nombre à Multiplier"),
    }),
  }
);