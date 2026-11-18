import { describe, expect, it } from "vite-plus/test";
import { generateApiKey, randomLetters } from "./generate-api-key";

describe("generateApiKey", () => {
  it("makes 64 letters after the prefix and starts with the first six", () => {
    const { key, start } = generateApiKey("bat_");
    expect(key).toMatch(/^bat_[a-zA-Z]{64}$/);
    expect(start).toBe(key.slice(0, 6));
    expect(generateApiKey(undefined).key).toMatch(/^[a-zA-Z]{64}$/);
  });

  it("drops bytes that would bias the letters", () => {
    // 207 is the last unbiased byte (51 = "Z"); 208 and above are skipped.
    const bytes = [255, 208, 0, 207, 26];
    let call = 0;
    const random = (size: number) =>
      Uint8Array.from({ length: size }, () => bytes[call++] ?? 0);
    expect(randomLetters(3, random)).toBe("aZA");
  });
});
