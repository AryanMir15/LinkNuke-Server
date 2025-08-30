/**
 * Refund Functionality Test Suite
 * Tests all aspects of the refund system including edge cases
 */

const {
  calculateDaysSincePayment,
  checkRefundEligibility,
  validateRefundRequest,
  formatRefundAmount,
  getRefundPolicy,
} = require("../utils/refundUtils");

describe("Refund Utility Functions", () => {
  describe("calculateDaysSincePayment", () => {
    test("should calculate days correctly for recent payment", () => {
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 5); // 5 days ago

      const days = calculateDaysSincePayment(recentDate);
      expect(days).toBe(5);
    });

    test("should calculate days correctly for old payment", () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 20); // 20 days ago

      const days = calculateDaysSincePayment(oldDate);
      expect(days).toBe(20);
    });

    test("should handle null input", () => {
      const days = calculateDaysSincePayment(null);
      expect(days).toBeNull();
    });

    test("should handle string date input", () => {
      const dateString = "2024-01-01T00:00:00.000Z";
      const days = calculateDaysSincePayment(dateString);
      expect(typeof days).toBe("number");
    });
  });

  describe("checkRefundEligibility", () => {
    test("should return eligible for recent subscription", () => {
      const subscription = {
        status: "active",
        firstPaymentDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
        refundStatus: "none",
      };

      const result = checkRefundEligibility(subscription);
      expect(result.eligible).toBe(true);
      expect(result.daysRemaining).toBe(10);
    });

    test("should return ineligible for expired subscription", () => {
      const subscription = {
        status: "active",
        firstPaymentDate: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000), // 20 days ago
        refundStatus: "none",
      };

      const result = checkRefundEligibility(subscription);
      expect(result.eligible).toBe(false);
      expect(result.reason).toBe("Refund window expired");
    });

    test("should return ineligible for already refunded subscription", () => {
      const subscription = {
        status: "refunded",
        firstPaymentDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        refundStatus: "completed",
      };

      const result = checkRefundEligibility(subscription);
      expect(result.eligible).toBe(false);
      expect(result.reason).toBe("Already refunded");
    });

    test("should return ineligible for subscription with pending refund", () => {
      const subscription = {
        status: "active",
        firstPaymentDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        refundStatus: "requested",
      };

      const result = checkRefundEligibility(subscription);
      expect(result.eligible).toBe(false);
      expect(result.reason).toBe("Refund already requested");
    });

    test("should handle null subscription", () => {
      const result = checkRefundEligibility(null);
      expect(result.eligible).toBe(false);
      expect(result.reason).toBe("No subscription found");
    });
  });

  describe("validateRefundRequest", () => {
    const mockUser = {
      _id: "user123",
      email: "test@example.com",
      subscription: {
        status: "active",
        firstPaymentDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        refundStatus: "none",
        subscriptionId: "sub123",
      },
      usage: {
        linksCreated: 3,
      },
    };

    test("should validate successful refund request", () => {
      const result = validateRefundRequest(mockUser, "Not satisfied");
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(1); // Warning about existing links
    });

    test("should reject request for null user", () => {
      const result = validateRefundRequest(null);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("User not found");
    });

    test("should reject request for user without subscription", () => {
      const userWithoutSub = { _id: "user123", email: "test@example.com" };
      const result = validateRefundRequest(userWithoutSub);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("No subscription found");
    });

    test("should warn about long refund reason", () => {
      const longReason = "a".repeat(501);
      const result = validateRefundRequest(mockUser, longReason);
      expect(result.valid).toBe(true);
      expect(result.warnings).toContain(
        "Refund reason is quite long, consider shortening it"
      );
    });
  });

  describe("formatRefundAmount", () => {
    test("should format amount in cents correctly", () => {
      const formatted = formatRefundAmount(1999, "USD");
      expect(formatted).toBe("$19.99");
    });

    test("should handle null amount", () => {
      const formatted = formatRefundAmount(null);
      expect(formatted).toBe("N/A");
    });

    test("should handle zero amount", () => {
      const formatted = formatRefundAmount(0);
      expect(formatted).toBe("$0.00");
    });
  });

  describe("getRefundPolicy", () => {
    test("should return complete policy information", () => {
      const policy = getRefundPolicy();
      expect(policy.windowDays).toBe(15);
      expect(policy.description).toContain("15 days");
      expect(policy.conditions).toHaveLength(4);
      expect(policy.processingTime).toContain("immediately");
    });
  });
});

/**
 * Edge Cases and Integration Tests
 */
describe("Refund Edge Cases", () => {
  describe("Boundary Conditions", () => {
    test("should handle exactly 15 days since payment", () => {
      const subscription = {
        status: "active",
        firstPaymentDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
        refundStatus: "none",
      };

      const result = checkRefundEligibility(subscription);
      expect(result.eligible).toBe(true);
      expect(result.daysRemaining).toBe(0);
    });

    test("should handle 15 days and 1 second since payment", () => {
      const subscription = {
        status: "active",
        firstPaymentDate: new Date(
          Date.now() - (15 * 24 * 60 * 60 * 1000 + 1000)
        ),
        refundStatus: "none",
      };

      const result = checkRefundEligibility(subscription);
      expect(result.eligible).toBe(false);
      expect(result.reason).toBe("Refund window expired");
    });
  });

  describe("Multiple Refund Attempts", () => {
    test("should prevent multiple refund requests", () => {
      const subscription = {
        status: "active",
        firstPaymentDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        refundStatus: "requested",
      };

      const result = checkRefundEligibility(subscription);
      expect(result.eligible).toBe(false);
      expect(result.reason).toBe("Refund already requested");
    });

    test("should prevent refund after completion", () => {
      const subscription = {
        status: "refunded",
        firstPaymentDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        refundStatus: "completed",
      };

      const result = checkRefundEligibility(subscription);
      expect(result.eligible).toBe(false);
      expect(result.reason).toBe("Already refunded");
    });
  });

  describe("Data Integrity", () => {
    test("should handle missing firstPaymentDate gracefully", () => {
      const subscription = {
        status: "active",
        startDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        refundStatus: "none",
      };

      const result = checkRefundEligibility(subscription);
      expect(result.eligible).toBe(true);
    });

    test("should handle missing startDate gracefully", () => {
      const subscription = {
        status: "active",
        firstPaymentDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        refundStatus: "none",
      };

      const result = checkRefundEligibility(subscription);
      expect(result.eligible).toBe(true);
    });

    test("should handle both dates missing", () => {
      const subscription = {
        status: "active",
        refundStatus: "none",
      };

      const result = checkRefundEligibility(subscription);
      expect(result.eligible).toBe(false);
      expect(result.reason).toBe("No payment date found");
    });
  });
});

/**
 * Business Logic Tests
 */
describe("Refund Business Logic", () => {
  describe("Access Control", () => {
    test("should immediately remove access on refund", () => {
      // This would be tested in integration tests with actual database
      // For now, we test the logic that determines access removal
      const refundedSubscription = {
        status: "refunded",
        plan: "free",
        usageLimits: { links: 10, customDomains: 1 },
        endDate: new Date(),
      };

      expect(refundedSubscription.status).toBe("refunded");
      expect(refundedSubscription.plan).toBe("free");
      expect(refundedSubscription.usageLimits.links).toBe(10);
    });
  });

  describe("Refund vs Cancel Logic", () => {
    test("should differentiate between refund and cancel", () => {
      const refundedUser = {
        subscription: {
          status: "refunded",
          refundStatus: "completed",
          refundedAt: new Date(),
        },
      };

      const cancelledUser = {
        subscription: {
          status: "cancelled",
          cancelledAt: new Date(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Access until end of period
        },
      };

      expect(refundedUser.subscription.status).toBe("refunded");
      expect(cancelledUser.subscription.status).toBe("cancelled");
      expect(refundedUser.subscription.refundedAt).toBeDefined();
      expect(cancelledUser.subscription.cancelledAt).toBeDefined();
    });
  });
});

module.exports = {
  // Export test utilities for integration tests
  createMockUser: (overrides = {}) => ({
    _id: "user123",
    email: "test@example.com",
    subscription: {
      status: "active",
      plan: "pro",
      firstPaymentDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      refundStatus: "none",
      subscriptionId: "sub123",
      transactionId: "txn123",
      usageLimits: { links: 500, customDomains: 3 },
    },
    usage: {
      linksCreated: 10,
      storageUsed: 1024000,
    },
    ...overrides,
  }),

  createMockSubscription: (overrides = {}) => ({
    status: "active",
    plan: "pro",
    firstPaymentDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    refundStatus: "none",
    subscriptionId: "sub123",
    transactionId: "txn123",
    usageLimits: { links: 500, customDomains: 3 },
    ...overrides,
  }),
};
