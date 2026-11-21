import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

// Fresh processes ensure identity, membership and workflow semantics survive
// restart rather than accidentally depending on a registration-time closure.
describe("organisation restart continuity", () => {
  it("restores authenticated authority, signed User attribution and executable workflow definition", () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), "arturo-organisation-restart-"));
    const run = (code: string) => spawnSync(process.execPath, ["-r", "ts-node/register/transpile-only", "-e", code], {
      cwd: path.resolve(__dirname, "../.."), encoding: "utf8", timeout: 20_000,
      env: { ...process.env, ARTURO_DATA_DIRECTORY: directory, ARTURO_RUNTIME_DATABASE_PATH: path.join(directory, "runtime.db") },
    });
    try {
      const saved = run(`
        const identity = require('./src/identity/organisationIdentity');
        const workers = require('./src/control/workers');
        const org = require('./src/enterprise/enterpriseStore').createAndSaveEnterprise({name:'Practice'});
        workers.addWorker(workers.createHumanWorker('Partner'));
        workers.registerWorkflowWorker('Format', {version:1,steps:[{operation:'template',template:'Matter: {{input}}'}]});
        const user = identity.provisionUser({issuer:'verified-local',subject:'partner',displayName:'Partner'});
        identity.setEnterpriseMembership({enterpriseId:org.id,userId:user.id,role:'reviewer',status:'active'});
        identity.assignWorkerOwnership({enterpriseId:org.id,workerName:'Partner',userId:user.id});
        identity.assignWorkerOwnership({enterpriseId:org.id,workerName:'Format'});
        const token = identity.issueUserSession(user.id);
        const signed = require('./src/runtime/approvalDecisionSigning').createSignedApprovalDecision({worker:'Partner',userId:user.id,decision:'approved',timestamp:1}, 'job-1', 'restart-test-secret');
        require('./src/storage/approvalChainRepository').saveApprovalChain({jobId:'job-1',requiredApprovals:1,decisions:[signed],status:'approved'});
        console.log(JSON.stringify({userId:user.id,enterpriseId:org.id,token}));
        require('./src/storage/runtimeDatabase').runtimeDb.close();
      `);
      expect(saved.status, saved.stderr).toBe(0);
      const fixture = JSON.parse(saved.stdout);
      const loaded = run(`
        const fixture = ${JSON.stringify(fixture)};
        const identity = require('./src/identity/organisationIdentity');
        const user = identity.authenticateUserSession(fixture.token);
        const worker = require('./src/control/workers').getWorker('Format');
        const decision = require('./src/storage/approvalChainRepository').loadApprovalChains()[0].decisions[0];
        const signing = require('./src/runtime/approvalDecisionSigning');
        console.log(JSON.stringify({
          userId:user.id,
          authorized:identity.authorizeHumanDecision(user,'Partner',fixture.enterpriseId),
          crossEnterprise:identity.workerBelongsToEnterprise('Format','another-enterprise'),
          result:require('./src/control/workflowWorker').executeWorkflowDefinition(worker.workflowDefinition,'Intake'),
          attributedUserId:decision.userId,
          validSignature:signing.verifyApprovalDecisionSignature(decision,'job-1','restart-test-secret'),
          tamperedSignature:signing.verifyApprovalDecisionSignature({...decision,userId:'other'},'job-1','restart-test-secret')
        }));
        require('./src/storage/runtimeDatabase').runtimeDb.close();
      `);
      expect(loaded.status, loaded.stderr).toBe(0);
      expect(JSON.parse(loaded.stdout)).toEqual({ userId:fixture.userId, authorized:true, crossEnterprise:false, result:'Matter: Intake', attributedUserId:fixture.userId, validSignature:true, tamperedSignature:false });
    } finally { rmSync(directory, {recursive:true,force:true}); }
  }, 45_000);
});
