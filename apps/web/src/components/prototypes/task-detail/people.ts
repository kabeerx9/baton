import type { Person } from "./types";

const person = (id: string, name: string, hue: number): Person => {
  const parts = name.split(" ");
  return {
    id,
    name,
    initials: ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase(),
    hue,
    image: null,
  };
};

export const KABEER = person("u-kabeer", "Kabeer Joshi", 250);
export const PRIYA = person("u-priya", "Priya Nair", 25);
export const DANA = person("u-dana", "Dana Whitfield", 160);
export const SAM = person("u-sam", "Sam Okafor", 330);
export const LENA = person("u-lena", "Lena Brandt", 95);
