import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { clearWorkers, registerWorkflowWorker, setWorkerAvailability } from "../control/workers";
import { clearJobs, listJobs } from "../runtime/jobQueue";
import { clearEnterprises, createAndSaveEnterprise } from "../enterprise/enterpriseStore";
import { assignWorkerOwnership } from "../identity/organisationIdentity";
import { handleWorkerLifecycleCommand } from "./workerLifecycleCommands";

beforeEach(() => { clearWorkers(); clearJobs(); clearEnterprises(); vi.spyOn(console,"log").mockImplementation(()=>{}); });
afterEach(() => { vi.restoreAllMocks(); });
it("queues explicit deterministic work through the ordinary governed Job runtime", () => {
 registerWorkflowWorker("Formatter",{version:1,steps:[{operation:"template",template:"{{input}}"}]});
 handleWorkerLifecycleCommand("/workflow-run",["Formatter","Matter 12"]);
 expect(listJobs()).toHaveLength(1);
 expect(listJobs()[0]).toMatchObject({worker:"Formatter",task:"Matter 12",requiredCapabilities:["conversion"],status:"queued"});
});
it("refuses unavailable and cross-Enterprise workflow assignment without queuing work", () => {
 const one=createAndSaveEnterprise({name:"One"}),two=createAndSaveEnterprise({name:"Two"});
 registerWorkflowWorker("Formatter",{version:1,steps:[{operation:"template",template:"{{input}}"}]});
 assignWorkerOwnership({workerName:"Formatter",enterpriseId:one.id});
 handleWorkerLifecycleCommand("/workflow-run",["Formatter","Matter","--enterprise",two.id]);
 expect(listJobs()).toHaveLength(0);
 setWorkerAvailability("Formatter","busy");
 handleWorkerLifecycleCommand("/workflow-run",["Formatter","Matter","--enterprise",one.id]);
 expect(listJobs()).toHaveLength(0);
 setWorkerAvailability("Formatter","available");
 handleWorkerLifecycleCommand("/workflow-run",["Formatter","Matter","--enterprise",one.id]);
 expect(listJobs()[0]).toMatchObject({enterpriseId:one.id,worker:"Formatter"});
});
