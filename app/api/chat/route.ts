import { getNeon } from "@/lib/neon";
import { openai } from "@/lib/openai";
import { Message, OpenAIStream, StreamingTextResponse } from "ai";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
// import {  } from "openai";
import { ChatCompletionMessageParam } from "openai/resources/index.mjs";

// Optional, but recommended: run on the edge runtime.
// See https://vercel.com/docs/concepts/functions/edge-functions
export const runtime = "edge";

const SYSTEM_MESSAGE = `
Context : 
You are Gama Docs GPT, a chatbot that know up to date information about Gama.
Your task is to create simple, easy to understand responses to questions about Gama.
You are good in pedagogy and you are able to explain complex concepts in a simple way.
You are a senior Gama developer and you have a deep understanding of the framework.

Goal : 
Create a response to the user's question about Gama.

Criteria:
To answer to the user's questions, you will be given a context of the documentation of Gama framework.
You need to use this context to create a response to the user's question.
Response format:
* Short
* To the point
* With examples
* With metaphors
* Using markdown
* Space separated
`;
const checkUsage = async () => {
  const headerList = headers();
  const ip = headerList.get("x-real-ip") || headerList.get("x-forwarded-for");

  // check if the ip has not made more than 5 requests in the last 10 minutes
  const sql = getNeon();

  const searchQuery = `
  SELECT COUNT(*) AS count
  FROM usage
  WHERE ip_address = $1 AND created_at > NOW() - INTERVAL '10 minutes';
  `;

  const searchQueryParams = [ip];

  const searchResult = (await sql(searchQuery, searchQueryParams)) as {
    count: number;
  }[];

  if (searchResult[0].count > 50) {
    throw new Error("Too many requests");
  }

  // insert the ip address
  const insertQuery = `
  INSERT INTO usage (ip_address)
  VALUES ($1);
  `;

  const insertQueryParams = [ip];

  await sql(insertQuery, insertQueryParams);
};

export async function POST(req: Request) {
  // Extract the `messages` from the body of the request
  const { messages } = (await req.json()) as { messages: Message[] };

  try {
    await checkUsage();
  } catch (e) {
    return NextResponse.json(
      {
        error: "Too many requests",
      },
      {
        status: 429,
      }
    );
  }

  const lastMessage = messages[messages.length - 1];
  const userPrompt = lastMessage.content;

  // console.log("User Prompt: ", userPrompt);
  // console.log("Messages: ", lastMessage);

  try {
    const response = await openai.embeddings.create({
      input: userPrompt,
      model: "text-embedding-ada-002",
    });

    const promptEmbedding = response.data[0].embedding;
    const promptEmbeddingFormatted = promptEmbedding
      .toString()
      .replace(/\.\.\./g, "");

    // console.log(promptEmbedding, promptEmbeddingFormatted);

    const sql = getNeon();
    const insertQuery = `
    SELECT text, file_path
    FROM ( 
      SELECT text, n_tokens, embeddings, file_path,
      (embeddings <=> '[${promptEmbeddingFormatted}]') AS distances,
      SUM(n_tokens) OVER (ORDER BY (embeddings <=> '[${promptEmbeddingFormatted}]')) as cum_n_tokens
      FROM documents
    ) subquery
    WHERE cum_n_tokens <= $1
    ORDER BY distances ASC;
  `;
    const queryParams = [1700];
    const result = (await sql(insertQuery, queryParams)) as {
      text: string;
      file_path: string;
    }[];
    // console.log("Resultat ou reponse :", result);
    const formattedResult = result.map((r) => {
      return {
        url: r.file_path.replaceAll("-", "/").replace(".txt", ""),
        content: r.text,
      };
    });

    const context = formattedResult
      .map((r) => {
        return `${r.url} : ${r.content}`;
      })
      .join("\n\n");

    const otherMessages = messages.slice(messages.length - 1).map((m) => {
      const mess: ChatCompletionMessageParam = {
        role: m.role as "assistant" | "user",
        content: String(m.content),
      };
      return mess;
    });
    const finalMessages: Array<ChatCompletionMessageParam> = [
      {
        role: "system",
        content: SYSTEM_MESSAGE,
      },
      ...otherMessages,
      {
        role: "system",
        content: `
        context:
        ${context}
        `,
      },
      {
        role: "user",
        content: userPrompt,
      },
    ];

    // Request the OpenAI API for the response based on the prompt
    const openAiResponse = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      stream: true,
      messages: finalMessages,
    });

    // Convert the response into a friendly text-stream
    const originalStream = OpenAIStream(openAiResponse);

    // Respond with the stream
    // Écoute la fin de la stream OpenAI
    const editedStream = new ReadableStream({
      start(controller) {
        const reader = originalStream.getReader();
        read();

        function read() {
          reader.read().then(({ done, value }) => {
            if (done) {
              // Ajoute ton texte personnalisé à la fin de la stream
              controller.enqueue(`\n\n### Source 
          
${formattedResult.map((r) => `* [${r.url}](${r.url})\n`).join("")}`);
              controller.close();
              return;
            }

            // Ajoute les données de la stream OpenAI à ta nouvelle stream
            controller.enqueue(value);
            read();
          });
        }
      },
    });
    // Respond with the stream
    return new StreamingTextResponse(editedStream);
  } catch {}
  // Remove the last message
}
