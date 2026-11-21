import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearBusinessFunctionDefinitions, listBusinessFunctionDefinitions } from "../business/businessFunctionDefinitionStore";
import { addWorker, clearWorkers, createHumanWorker, getWorker } from "../control/workers";
import { assignWorkerOwnership } from "../identity/organisationIdentity";
import { clearHumanTasks, getHumanTask } from "../runtime/humanTaskStore";
import { clearEnterprises, listEnterprises } from "../enterprise/enterpriseStore";
import { clearJobs, getJob, listJobs } from "../runtime/jobQueue";
import { clearStaffingAssignments, listStaffingAssignments } from "../staffing/staffingStore";
import { runtimeDb } from "../storage/runtimeDatabase";
import { setUpBusiness, addClient } from "./clientCommands";
import { assignClientDesk, clearAssistantProposals, createClientAssistant, parseChecklist, proposeClientAssistant, type AssistantProposal } from "./clientAssistant";
import { nextQuestions, openIntakeTasks, parseExtraction, talkToAssistant } from "./clientIntake";
import { clearClients, getClientRecord, listClientRecords } from "./clientStore";
import { BASE_CHECKLIST } from "./clientRecords";

const reset = () => {
  clearJobs(); clearClients(); clearWorkers(); clearStaffingAssignments(); clearBusinessFunctionDefinitions(); clearEnterprises(); clearAssistantProposals();
  runtimeDb.prepare("DELETE FROM enterprise_worker_memberships").run();
};

const LAW_CHECKLIST = [
  "Other parties | Who else is involved, such as the other side? | Needed for the conflict-of-interest check",
  "Matter | What is the legal matter about? | To open the right file",
  "Deadline | Is there a deadline or court date? | Limitation periods and urgent dates",
].join("\n");

const CLINIC_CHECKLIST = [
  "Date of birth | What is their date of birth? | To identify the patient",
  "Reason for visit | What are they coming in for? | To book the right appointment",
].join("\n");

/** A model that answers the checklist question, then each extraction in turn. */
const scripted = (checklist: string, extractions: string[]) => {
  const prompts: string[] = [];
  const ask = vi.fn(async (prompt: string) => {
    prompts.push(prompt);
    if (prompt.includes("List the other things THIS kind of business needs")) return checklist;
    return extractions.shift() ?? "none";
  });
  return { ask, prompts };
};

const setUpLawPractice = async (ask: (prompt: string) => Promise<string>) => {
  setUpBusiness(["Harbour Legal", "--owner", "Amy Chen", "--about", "Sole law practice: commercial leases and property"]);
  const enterpriseId = listEnterprises()[0].id;
  const proposal = await proposeClientAssistant(enterpriseId, ask) as AssistantProposal;
  expect(createClientAssistant({ enterpriseId, proposalId: proposal.id, as: "Amy Chen" })).toMatchObject({ created: true });
  return { enterpriseId, proposal };
};

describe("an assistant to take down new clients", () => {
  beforeEach(() => { reset(); vi.spyOn(console, "log").mockImplementation(() => undefined); });
  afterEach(() => { vi.restoreAllMocks(); reset(); });

  it("is not there until the owner agrees, and the conversation says so", async () => {
    setUpBusiness(["Harbour Legal", "--owner", "Amy Chen", "--about", "Sole law practice"]);
    const outcome = await talkToAssistant({ enterpriseId: listEnterprises()[0].id, as: "Amy Chen", message: "New client: Jane Smith" }, async () => "none");
    expect(outcome).toMatchObject({ replied: false, needsAssistant: true });
    expect(getWorker("Clients AI worker")).toBeUndefined();
  });

  it("asks a law practice and a clinic different things, worked out from what each does", async () => {
    setUpBusiness(["Harbour Legal", "--owner", "Amy Chen", "--about", "Sole law practice"]);
    setUpBusiness(["Kauri Clinic", "--owner", "Dr Lee", "--about", "Family medical practice"]);
    const [law, clinic] = listEnterprises();
    const lawProposal = await proposeClientAssistant(law.id, async () => LAW_CHECKLIST) as AssistantProposal;
    const clinicProposal = await proposeClientAssistant(clinic.id, async () => CLINIC_CHECKLIST) as AssistantProposal;
    expect(lawProposal.checklist.map((item) => item.label)).toEqual(["Name", "Phone", "Email", "Address", "Other parties", "Matter", "Deadline"]);
    expect(clinicProposal.checklist.map((item) => item.label)).toContain("Date of birth");
    expect(lawProposal.cannotDo).toContain("Email or phone anyone outside the business.");
  });

  it("falls back to general questions when the model cannot help, and says so", async () => {
    setUpBusiness(["Harbour Legal", "--owner", "Amy Chen", "--about", "Sole law practice"]);
    const proposal = await proposeClientAssistant(listEnterprises()[0].id, async () => { throw new Error("offline"); }) as AssistantProposal;
    expect(proposal).toMatchObject({ fellBack: true });
    expect(proposal.checklist.map((item) => item.label)).toEqual(["Name", "Phone", "Email", "Address", "What they need", "How they heard of you"]);
  });

  it("sets up the assistant, its area of work and its approver only when agreed", async () => {
    const { ask } = scripted(LAW_CHECKLIST, []);
    await setUpLawPractice(ask);
    const area = listBusinessFunctionDefinitions().find((row) => row.label === "Clients")!;
    expect(getWorker("Clients AI worker")).toMatchObject({ kind: "ai", archetype: "assistant" });
    expect(getWorker("Clients AI worker")!.capabilities).not.toContain("email-send");
    expect(listStaffingAssignments().filter((row) => row.businessFunctionId === area.id).map((row) => [row.workerName, row.role]))
      .toEqual(expect.arrayContaining([["Clients AI worker", "ai"], ["Amy Chen", "human-approver"]]));
  });

  it("takes down a client like a PA: asks for what is missing, reads it back, and enters it only on yes", async () => {
    const { ask, prompts } = scripted(LAW_CHECKLIST, [
      "name: Jane Smith\nphone: 021 555 0101\nmatter: Commercial lease review\ndeadline: Friday",
      "email: -\naddress: 12 Wharf Street, Auckland",
      "other_parties: Harbour Properties Ltd (landlord)",
    ]);
    const { enterpriseId } = await setUpLawPractice(ask);
    const talk = (message: string) => talkToAssistant({ enterpriseId, as: "Amy Chen", message }, ask);

    const first = await talk("Just had Jane Smith on the phone, 021 555 0101. Wants her commercial lease looked at before Friday.");
    expect(first.reply).toContain("Got it: Jane Smith, 021 555 0101");
    expect(first.reply).toContain("Do you have an email address for them? And what's their postal address?");
    expect(prompts.at(-1)).toContain("Jane Smith on the phone");

    const second = await talk("No email. She's at 12 Wharf Street, Auckland.");
    expect(second.reply).toContain("Who else is involved, such as the other side?");

    const third = await talk("The landlord, Harbour Properties Ltd.");
    expect(third.conversation?.status).toBe("reading_back");
    expect(third.reply).toContain("Here's what I'll add to Arturo's list of clients:");
    expect(third.reply).toContain("Other parties: Harbour Properties Ltd (landlord)");
    expect(third.reply).toContain("Not given: Email.");
    // The lookalike check is not a conflict check, and the read-back says so.
    expect(third.reply).toContain("Arturo does not run a conflict check");
    expect(listClientRecords(enterpriseId)).toEqual([]);

    const saved = await talk("Yes");
    expect(saved.reply).toBe("Done. Jane Smith is now on Arturo's list of clients, as client-1.");
    expect(getClientRecord("client-1")).toMatchObject({
      name: "Jane Smith", phone: "021 555 0101", address: "12 Wharf Street, Auckland", addedBy: "Amy Chen",
      details: [{ label: "Other parties", value: "Harbour Properties Ltd (landlord)" }, { label: "Matter", value: "Commercial lease review" }, { label: "Deadline", value: "Friday" }],
    });
    const task = getJob(saved.conversation!.taskId!)!;
    expect(task).toMatchObject({ status: "completed", selectedWorker: "Clients AI worker", requestedBy: "Amy Chen", clientId: "client-1" });
    expect(task.output).toContain("after Amy Chen confirmed the read-back");
    // Arturo recognised "yes"; the model was not asked to decide it.
    expect(ask).toHaveBeenCalledTimes(4);
  });

  it("starts afresh for a new request, so nothing from an unfinished one carries over", async () => {
    const { ask } = scripted(LAW_CHECKLIST, [
      "name: Jane Smith\nother_parties: Harbour Properties Ltd",
      "name: Joe Bloggs\nphone: 555-6789",
    ]);
    const { enterpriseId } = await setUpLawPractice(ask);
    await talkToAssistant({ enterpriseId, as: "Amy Chen", message: "Jane Smith, the other side is Harbour Properties" }, ask);
    const joe = await talkToAssistant({ enterpriseId, as: "Amy Chen", message: "I need a new client added: Joe Bloggs 555-6789", fresh: true }, ask);
    expect(joe.conversation?.draft).toEqual({ name: "Joe Bloggs", phone: "555-6789" });
    const { loadAssistantConversations } = await import("../storage/clientRepository");
    expect(loadAssistantConversations(enterpriseId, "Amy Chen").map((row) => row.status)).toEqual(["cancelled", "taking"]);
  });

  it("takes a correction at the read-back instead of saving", async () => {
    const { ask } = scripted(LAW_CHECKLIST, [
      "name: Jane Smith\nphone: 021 555 0101\nemail: -\naddress: -\nother_parties: -\nmatter: -\ndeadline: -",
      "phone: 021 555 0102",
    ]);
    const { enterpriseId } = await setUpLawPractice(ask);
    const talk = (message: string) => talkToAssistant({ enterpriseId, as: "Amy Chen", message }, ask);
    expect((await talk("Jane Smith, 021 555 0101, that's all I have")).conversation?.status).toBe("reading_back");
    const corrected = await talk("Sorry, the phone is 021 555 0102");
    expect(corrected.reply).toContain("Phone: 021 555 0102");
    expect(listClientRecords(enterpriseId)).toEqual([]);
    expect((await talk("yes")).reply).toContain("Arturo's list of clients, as client-1");
    expect(getClientRecord("client-1")?.phone).toBe("021 555 0102");
  });

  it("asks before entering someone who may already be a client, and enters nothing if it is the same person", async () => {
    const { ask } = scripted(LAW_CHECKLIST, [
      "name: Jayne Smith\nphone: -\nemail: -\naddress: -\nother_parties: -\nmatter: -\ndeadline: -",
      "name: Jayne Smith\nphone: -\nemail: -\naddress: -\nother_parties: -\nmatter: -\ndeadline: -",
    ]);
    const { enterpriseId } = await setUpLawPractice(ask);
    addClient(["Jane Smith", "--enterprise", enterpriseId, "--as", "Amy Chen"]);
    const talk = (message: string) => talkToAssistant({ enterpriseId, as: "Amy Chen", message }, ask);

    await talk("Jayne Smith, nothing else");
    const match = await talk("yes");
    expect(match.conversation?.status).toBe("checking_match");
    expect(match.reply).toContain("Arturo's list of clients already has Jane Smith (client-1, a very similar name)");
    expect((await talk("Same person")).reply).toContain("I haven't added them again");
    expect(listClientRecords(enterpriseId)).toHaveLength(1);

    await talk("Jayne Smith again, nothing else");
    await talk("yes");
    expect((await talk("Someone new")).reply).toContain("Arturo's list of clients, as client-2");
    expect(getClientRecord("client-2")?.confirmedNewDespite).toEqual(["client-1"]);
  });

  it("enters nobody on an unclear answer to \"someone new, or the same person?\"", async () => {
    const { lookalikeAnswer } = await import("./clientIntake");
    for (const same of ["Same person", "No, same", "It is the same person, do not add them", "yes, that is the same person", "That's him", "Don't add her, we already have her", "already a client"]) {
      expect(lookalikeAnswer(same), same).toBe("same");
    }
    for (const fresh of ["Someone new", "someone new, please add them", "Not the same person", "different person", "a new client"]) {
      expect(lookalikeAnswer(fresh), fresh).toBe("new");
    }
    for (const unclear of ["yes", "y", "ok", "hmm", "not sure", "someone new? no, the same"]) {
      expect(lookalikeAnswer(unclear), unclear).toBeUndefined();
    }

    const { ask } = scripted(LAW_CHECKLIST, ["name: Jayne Smith\nphone: -\nemail: -\naddress: -\nother_parties: -\nmatter: -\ndeadline: -"]);
    const { enterpriseId } = await setUpLawPractice(ask);
    addClient(["Jane Smith", "--enterprise", enterpriseId, "--as", "Amy Chen"]);
    const talk = (message: string) => talkToAssistant({ enterpriseId, as: "Amy Chen", message }, ask);
    await talk("Jayne Smith, nothing else");
    expect((await talk("yes")).conversation?.status).toBe("checking_match");
    expect((await talk("yes")).reply).toContain("Is this someone new, or the same person");
    expect((await talk("It is the same person, do not add them")).reply).toContain("I haven't added them again");
    expect(listClientRecords(enterpriseId)).toHaveLength(1);
  });

  it("re-asks for a bad email, cancels on request, and survives the model failing", async () => {
    const { ask } = scripted(LAW_CHECKLIST, ["name: Bob\nemail: bob-at-example"]);
    const { enterpriseId } = await setUpLawPractice(ask);
    const talk = (message: string, model: (prompt: string) => Promise<string> = ask) => talkToAssistant({ enterpriseId, as: "Amy Chen", message }, model);
    const bad = await talk("Bob, bob-at-example");
    expect(bad.reply).toContain("does not look like an email address");
    expect(bad.conversation?.draft.email).toBeUndefined();
    expect((await talk("hello", async () => { throw new Error("offline"); })).reply).toContain("Could you say it again?");
    expect((await talk("Never mind")).reply).toContain("I haven't entered anything");
    expect(listClientRecords(enterpriseId)).toEqual([]);
    expect(listJobs()).toEqual([]);
  });

  it("refuses people who do not work at the business", async () => {
    const { ask } = scripted(LAW_CHECKLIST, []);
    const { enterpriseId } = await setUpLawPractice(ask);
    expect(await talkToAssistant({ enterpriseId, as: "Stranger", message: "Add Bob" }, ask)).toMatchObject({ replied: false });
  });
});

describe("the pieces Arturo decides without a model", () => {
  it("reads only the asked form from the model", () => {
    const keys = new Set(["name", "phone", "notes"]);
    expect(parseExtraction("Sure! Here you go:\nname: Jane Smith\nphone: -\nsalary: 100\n- notes: \"Prefers mornings\"", keys))
      .toEqual({ values: { name: "Jane Smith", notes: "Prefers mornings" }, declined: ["phone"] });
  });

  it("asks for the name until given, and everything else once", () => {
    expect(nextQuestions(BASE_CHECKLIST, {}, ["name", "phone"]).map((item) => item.key)).toEqual(["name", "email"]);
    expect(nextQuestions(BASE_CHECKLIST, { name: "Jane" }, ["phone", "email", "address"])).toEqual([]);
  });

  it("drops checklist lines that are not in the asked form or repeat the base questions", () => {
    expect(parseChecklist("Here are some:\n1. Other parties | Who else is involved? | Conflicts\nPhone | What is their phone? | x\nnonsense line\n<b> | x | y").map((item) => item.key))
      .toEqual(["other_parties"]);
  });
});

describe("recognising yes", () => {
  it("accepts the ways people say yes, and nothing that changes the record", async () => {
    const { YES_FOR_TESTS } = await import("./clientIntake");
    for (const yes of ["Yes", "yes, save it", "Yes, add them", "Yes please", "ok", "That's right, thanks", "Looks good!"]) expect(YES_FOR_TESTS.test(yes), yes).toBe(true);
    for (const no of ["yes but the phone is 021 555 0102", "no", "save it under her maiden name", "right, change the email"]) expect(YES_FOR_TESTS.test(no), no).toBe(false);
  });
});

describe("new clients come in by conversation", () => {
  beforeEach(() => { reset(); clearHumanTasks(); vi.spyOn(console, "log").mockImplementation(() => undefined); });
  afterEach(() => { vi.restoreAllMocks(); reset(); clearHumanTasks(); });

  it("takes every detail given at once and goes straight to the read-back", async () => {
    const { ask } = scripted(LAW_CHECKLIST, [
      "name: Jane Smith\nemail: jane@example.com\nphone: 021 555 0101\naddress: 12 Wharf Street\nother_parties: Harbour Properties Ltd\nmatter: Lease review\ndeadline: Friday",
    ]);
    const { enterpriseId } = await setUpLawPractice(ask);
    const outcome = await talkToAssistant({
      enterpriseId, as: "Amy Chen",
      message: "I'd like to add a new client. Their email is jane@example.com. Their full name is Jane Smith, 021 555 0101, 12 Wharf Street. Lease review against Harbour Properties Ltd, before Friday.",
    }, ask);
    expect(outcome).toMatchObject({ replied: true, reply: expect.stringContaining("Here's what I'll add to Arturo's list of clients:") });
    expect(listJobs()).toEqual([]);
  });

  it("hands a new client to the person who takes them down, as a Human Task; their own conversation enters the client and marks it done", async () => {
    setUpBusiness(["Harbour Legal", "--owner", "Amy Chen", "--about", "Sole law practice"]);
    const enterpriseId = listEnterprises()[0].id;
    addWorker(createHumanWorker("Sarah Jones", "assistant"));
    assignWorkerOwnership({ workerName: "Sarah Jones", enterpriseId });
    const proposal = await proposeClientAssistant(enterpriseId, async () => LAW_CHECKLIST) as AssistantProposal;
    expect(assignClientDesk({ enterpriseId, person: "Sarah Jones", as: "Amy Chen", proposalId: proposal.id })).toMatchObject({ created: true });
    expect(getWorker("Clients AI worker")).toBeUndefined();

    const model = vi.fn(async () => "name: Jane Smith\nphone: 021 555 0101\nemail: -\naddress: -\nother_parties: -\nmatter: -\ndeadline: -");
    const handed = await talkToAssistant({ enterpriseId, as: "Amy Chen", message: "Please add a new client, Jane Smith, 021 555 0101" }, model);
    expect(handed).toMatchObject({ replied: true, handedTo: "Sarah Jones" });
    expect(model).not.toHaveBeenCalled();
    const [task] = openIntakeTasks("Sarah Jones");
    expect(task).toMatchObject({ owner: "Sarah Jones", fromWorker: "Amy Chen", title: "Take down a new client" });
    expect(task.instructions).toContain('Amy Chen said: "Please add a new client, Jane Smith, 021 555 0101"');

    const sarah = (message: string) => talkToAssistant({ enterpriseId, as: "Sarah Jones", message }, model);
    expect((await sarah("Jane Smith, 021 555 0101, nothing else")).conversation?.status).toBe("reading_back");
    const saved = await sarah("yes");
    expect(saved.reply).toBe(`Done. Jane Smith is now on Arturo's list of clients, as client-1. ${task.id} is marked done.`);
    expect(getClientRecord("client-1")?.addedBy).toBe("Sarah Jones");
    expect(getHumanTask(task.id)).toMatchObject({ status: "completed", completedBy: "Sarah Jones" });
  });
});
