import { tool } from "@langchain/core/tools";
import { z } from "zod";

export const add = tool(
  async ({ a, b }) => {
    return a + b;
  },
  {
    name: "add",
    description: "Additionne deux nombres.",
    schema: z.object({
      a: z.number().describe("Le premier nombre à additionner"),
      b: z.number().describe("Le deuxième nombre à additionner"),
    }),
  }
);