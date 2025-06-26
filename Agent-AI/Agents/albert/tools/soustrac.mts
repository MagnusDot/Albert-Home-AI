import { tool } from "@langchain/core/tools";
import { z } from "zod";
 export const soustrac = tool(
    async ({ a, b }) => {
        return a - b;
    }
    ,
    {
        name: "soustrac",
        description: "Soustrait deux nombres.",
        schema: z.object({
            a: z.number().describe("Le premier nombre à soustraire"),
            b: z.number().describe("Le deuxième nombre à soustraire"),
        }),
    }
);