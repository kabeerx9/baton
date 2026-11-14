import { Agent, fetch, type RequestInit as UndiciRequestInit } from "undici";
import { createDestinationLookup } from "./destination-lookup";

const agent = new Agent({ connect: { lookup: createDestinationLookup() } });

export const destinationFetch = async (
  input: string,
  init?: RequestInit,
): Promise<Response> => {
  const response = await fetch(input, {
    ...(init as UndiciRequestInit),
    dispatcher: agent,
  });
  return response as unknown as Response;
};
