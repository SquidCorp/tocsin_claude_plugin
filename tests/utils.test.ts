import { describe, it, expect } from "bun:test";
import { maskPhone, generateSessionId } from "../src/utils";

describe("Utils", () => {
  describe("maskPhone", () => {
    it("should mask middle digits of long phone numbers", () => {
      expect(maskPhone("+1234567890")).toBe("+123***7890");
      expect(maskPhone("+14155552671")).toBe("+141***2671");
    });

    it("should return short numbers unchanged", () => {
      expect(maskPhone("1234")).toBe("1234");
      expect(maskPhone("12345678")).toBe("12345678");
    });

    it("should handle 9-digit numbers", () => {
      expect(maskPhone("123456789")).toBe("123***6789");
    });
  });

  describe("generateSessionId", () => {
    it("should generate unique IDs", () => {
      const id1 = generateSessionId();
      const id2 = generateSessionId();
      
      expect(id1).not.toBe(id2);
      expect(id1.startsWith("claude-")).toBe(true);
      expect(id2.startsWith("claude-")).toBe(true);
    });

    it("should contain timestamp and random parts", () => {
      const id = generateSessionId();
      const parts = id.split("-");
      
      expect(parts.length).toBe(3);
      expect(parts[0]).toBe("claude");
      // parts[1] is timestamp (base36), parts[2] is random
      expect(parts[1].length).toBeGreaterThan(0);
      expect(parts[2].length).toBe(4);
    });
  });
});
