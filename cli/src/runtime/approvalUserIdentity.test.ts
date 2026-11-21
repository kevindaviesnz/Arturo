import { describe, expect, it } from "vitest";
import { addApprovalDecision, countApprovals, createApprovalChain, resolveApprovalChainStatus, type ApprovalDecision } from "./approvalChainStore";
import { evaluateApprovalPolicy } from "./approvalPolicy";

const first: ApprovalDecision = { worker:"Partner", userId:"alice", decision:"approved", timestamp:1 };
const second: ApprovalDecision = { worker:"Supervisor", userId:"alice", decision:"approved", timestamp:2 };

describe("distinct authenticated Human approval authority", () => {
  it("does not let two Worker identities belonging to one account satisfy a two-person threshold", () => {
    const once = addApprovalDecision(createApprovalChain("matter", 2), first);
    const twice = addApprovalDecision(once, second);
    expect(twice.status).toBe("pending");
    expect(twice.decisions).toHaveLength(1);
    expect(addApprovalDecision(twice, {...second,userId:"bob"}).status).toBe("approved");
  });
  it("recomputes stored decisions with unique Users for thresholds and unanimous policies", () => {
    const decisions = [first, second];
    const chain = {...createApprovalChain("matter", 2), decisions};
    expect(countApprovals(chain)).toBe(1);
    expect(resolveApprovalChainStatus(chain)).toBe("pending");
    expect(evaluateApprovalPolicy({type:"threshold",requiredApprovals:2},decisions)).toBe("pending");
    expect(evaluateApprovalPolicy({type:"veto",requiredApprovals:2},decisions)).toBe("pending");
    expect(evaluateApprovalPolicy({type:"unanimous",requiredWorkers:["Partner","Supervisor"]},decisions)).toBe("pending");
  });
  it("retains trusted legacy Worker identity while refusing duplicate Worker decisions", () => {
    const legacy = [{worker:"Partner",decision:"approved" as const,timestamp:1}, {worker:"Supervisor",decision:"approved" as const,timestamp:2}];
    expect(evaluateApprovalPolicy({type:"threshold",requiredApprovals:2},legacy)).toBe("approved");
    expect(evaluateApprovalPolicy({type:"threshold",requiredApprovals:2},[legacy[0],legacy[0]])).toBe("pending");
  });
});
