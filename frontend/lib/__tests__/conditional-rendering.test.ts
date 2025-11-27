import { describe, it, expect } from "vitest"
import {
  evaluateCondition,
  evaluateConditions,
  getConditionDependencies,
  ConditionEvaluationCache,
  type ConditionalRule,
} from "../conditional-rendering"

describe("conditional-rendering", () => {
  describe("evaluateCondition", () => {
    it("should return true for equals condition when values match", () => {
      const rule: ConditionalRule = {
        target: { type: "section", selector: "test" },
        showWhen: {
          field: {
            name: "type",
            operator: "equals",
            value: "natural",
          },
        },
      }

      const formData = { type: "natural" }
      expect(evaluateCondition(rule, formData)).toBe(true)
    })

    it("should return false for equals condition when values don't match", () => {
      const rule: ConditionalRule = {
        target: { type: "section", selector: "test" },
        showWhen: {
          field: {
            name: "type",
            operator: "equals",
            value: "natural",
          },
        },
      }

      const formData = { type: "legal" }
      expect(evaluateCondition(rule, formData)).toBe(false)
    })

    it("should return true for notEquals condition when values don't match", () => {
      const rule: ConditionalRule = {
        target: { type: "section", selector: "test" },
        showWhen: {
          field: {
            name: "type",
            operator: "notEquals",
            value: "natural",
          },
        },
      }

      const formData = { type: "legal" }
      expect(evaluateCondition(rule, formData)).toBe(true)
    })

    it("should return true for contains condition when string contains value", () => {
      const rule: ConditionalRule = {
        target: { type: "section", selector: "test" },
        showWhen: {
          field: {
            name: "text",
            operator: "contains",
            value: "test",
          },
        },
      }

      const formData = { text: "this is a test string" }
      expect(evaluateCondition(rule, formData)).toBe(true)
    })

    it("should return false for contains condition when string doesn't contain value", () => {
      const rule: ConditionalRule = {
        target: { type: "section", selector: "test" },
        showWhen: {
          field: {
            name: "text",
            operator: "contains",
            value: "missing",
          },
        },
      }

      const formData = { text: "this is a test string" }
      expect(evaluateCondition(rule, formData)).toBe(false)
    })

    it("should return true for in condition when value is in array", () => {
      const rule: ConditionalRule = {
        target: { type: "section", selector: "test" },
        showWhen: {
          field: {
            name: "type",
            operator: "in",
            value: ["natural", "legal"],
          },
        },
      }

      const formData = { type: "natural" }
      expect(evaluateCondition(rule, formData)).toBe(true)
    })

    it("should return false for in condition when value is not in array", () => {
      const rule: ConditionalRule = {
        target: { type: "section", selector: "test" },
        showWhen: {
          field: {
            name: "type",
            operator: "in",
            value: ["natural", "legal"],
          },
        },
      }

      const formData = { type: "other" }
      expect(evaluateCondition(rule, formData)).toBe(false)
    })

    it("should return true for notIn condition when value is not in array", () => {
      const rule: ConditionalRule = {
        target: { type: "section", selector: "test" },
        showWhen: {
          field: {
            name: "type",
            operator: "notIn",
            value: ["natural", "legal"],
          },
        },
      }

      const formData = { type: "other" }
      expect(evaluateCondition(rule, formData)).toBe(true)
    })

    it("should handle AND logic correctly", () => {
      const rule: ConditionalRule = {
        target: { type: "section", selector: "test" },
        showWhen: {
          logic: "and",
          conditions: [
            {
              target: { type: "section", selector: "test1" },
              showWhen: {
                field: { name: "type", operator: "equals", value: "natural" },
              },
            },
            {
              target: { type: "section", selector: "test2" },
              showWhen: {
                field: { name: "status", operator: "equals", value: "active" },
              },
            },
          ],
        },
      }

      expect(evaluateCondition(rule, { type: "natural", status: "active" })).toBe(true)
      expect(evaluateCondition(rule, { type: "natural", status: "inactive" })).toBe(false)
      expect(evaluateCondition(rule, { type: "legal", status: "active" })).toBe(false)
    })

    it("should handle OR logic correctly", () => {
      const rule: ConditionalRule = {
        target: { type: "section", selector: "test" },
        showWhen: {
          logic: "or",
          conditions: [
            {
              target: { type: "section", selector: "test1" },
              showWhen: {
                field: { name: "type", operator: "equals", value: "natural" },
              },
            },
            {
              target: { type: "section", selector: "test2" },
              showWhen: {
                field: { name: "type", operator: "equals", value: "legal" },
              },
            },
          ],
        },
      }

      expect(evaluateCondition(rule, { type: "natural" })).toBe(true)
      expect(evaluateCondition(rule, { type: "legal" })).toBe(true)
      expect(evaluateCondition(rule, { type: "other" })).toBe(false)
    })

    it("should return true when no condition is specified", () => {
      const rule: ConditionalRule = {
        target: { type: "section", selector: "test" },
        showWhen: {},
      }

      const formData = {}
      expect(evaluateCondition(rule, formData)).toBe(true)
    })
  })

  describe("evaluateConditions", () => {
    it("should evaluate multiple conditions", () => {
      const rules: ConditionalRule[] = [
        {
          target: { type: "section", selector: "section1" },
          showWhen: {
            field: { name: "type", operator: "equals", value: "natural" },
          },
        },
        {
          target: { type: "section", selector: "section2" },
          showWhen: {
            field: { name: "type", operator: "equals", value: "legal" },
          },
        },
      ]

      const results = evaluateConditions(rules, { type: "natural" })
      expect(results.get("section1")).toBe(true)
      expect(results.get("section2")).toBe(false)
    })
  })

  describe("getConditionDependencies", () => {
    it("should extract field dependencies from conditions", () => {
      const rules: ConditionalRule[] = [
        {
          target: { type: "section", selector: "section1" },
          showWhen: {
            field: { name: "type", operator: "equals", value: "natural" },
          },
        },
        {
          target: { type: "section", selector: "section2" },
          showWhen: {
            field: { name: "status", operator: "equals", value: "active" },
          },
        },
      ]

      const dependencies = getConditionDependencies(rules)
      expect(dependencies).toContain("type")
      expect(dependencies).toContain("status")
    })

    it("should extract dependencies from nested conditions", () => {
      const rules: ConditionalRule[] = [
        {
          target: { type: "section", selector: "section1" },
          showWhen: {
            logic: "and",
            conditions: [
              {
                target: { type: "section", selector: "test1" },
                showWhen: {
                  field: { name: "type", operator: "equals", value: "natural" },
                },
              },
              {
                target: { type: "section", selector: "test2" },
                showWhen: {
                  field: { name: "status", operator: "equals", value: "active" },
                },
              },
            ],
          },
        },
      ]

      const dependencies = getConditionDependencies(rules)
      expect(dependencies).toContain("type")
      expect(dependencies).toContain("status")
    })
  })

  describe("ConditionEvaluationCache", () => {
    it("should cache evaluation results", () => {
      const cache = new ConditionEvaluationCache()
      const hash = ConditionEvaluationCache.hashFormData({ type: "natural" })

      cache.set("section1", hash, true)
      expect(cache.get("section1", hash)).toBe(true)
    })

    it("should return null for cache miss", () => {
      const cache = new ConditionEvaluationCache()
      const hash = ConditionEvaluationCache.hashFormData({ type: "natural" })

      expect(cache.get("section1", hash)).toBeNull()
    })

    it("should return null for different hash", () => {
      const cache = new ConditionEvaluationCache()
      const hash1 = ConditionEvaluationCache.hashFormData({ type: "natural" })
      const hash2 = ConditionEvaluationCache.hashFormData({ type: "legal" })

      cache.set("section1", hash1, true)
      expect(cache.get("section1", hash2)).toBeNull()
    })

    it("should clear cache", () => {
      const cache = new ConditionEvaluationCache()
      const hash = ConditionEvaluationCache.hashFormData({ type: "natural" })

      cache.set("section1", hash, true)
      cache.clear()
      expect(cache.get("section1", hash)).toBeNull()
    })

    it("should limit cache size", () => {
      const cache = new ConditionEvaluationCache()
      const maxSize = 100

      // Add more than maxSize entries
      for (let i = 0; i < maxSize + 10; i++) {
        const hash = ConditionEvaluationCache.hashFormData({ index: i })
        cache.set(`section${i}`, hash, true)
      }

      // Cache should not exceed maxSize
      expect(cache["cache"].size).toBeLessThanOrEqual(maxSize)
    })
  })
})

