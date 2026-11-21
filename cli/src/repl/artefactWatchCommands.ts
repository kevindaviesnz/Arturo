import fs from "node:fs";
import os from "node:os";

import { expandHomeDirectory } from "../artefacts/artefactStore";
import { listBusinessFunctionDefinitionsByEnterprise } from "../business/businessFunctionDefinitionStore";
import { getWorker } from "../control/workers";
import { getEnterpriseByIdOrName } from "../enterprise/enterpriseStore";
import { MAX_ENTRIES_PER_FILE, refuseWatchedFolder } from "../intake/watchedFolder";
import {
  addWatchedFolder,
  listTakenInFiles,
  listWatchedFolders,
  removeWatchedFolder,
} from "../intake/watchedFolderRuntime";
import { resolveRuntimeDataDirectory } from "../storage/runtimeStoragePaths";
import { getArtefactFlagValue } from "./artefactCommands";

const USAGE =
  'Usage: /artefact watch add "<folder>" --function "<function>" --enterprise "<enterprise>" --task "<instruction>" --created-by "<person>" [--each "<list>" --first <number>] | /artefact watch list | /artefact watch remove <watch-id>';

const realPath = (candidate: string): string | undefined => {
  try {
    return fs.realpathSync(candidate);
  } catch {
    return undefined;
  }
};

/**
 * Handles `/artefact watch …`: have files that arrive in a folder registered
 * and handed to a Task without anyone typing.
 *
 * SIDE EFFECT: Reads the file system; may write the runtime database; prints.
 */
export function handleArtefactWatchCommand(
  args: readonly string[]
): void {
  const [operation, reference] = args;

  if (operation === "list" || operation === undefined) {
    const watches = listWatchedFolders();
    if (watches.length === 0) {
      console.log(`No folders are being watched.\n${USAGE}`);
      return;
    }
    for (const watch of watches) {
      const files = listTakenInFiles(watch.id);
      const takenIn = files.filter((file) => file.taskId);
      const last = takenIn[takenIn.length - 1];
      console.log(
        [
          `${watch.id}  ${watch.folder}${realPath(watch.folder) ? "" : "  (this folder cannot be read right now)"}`,
          `  For:          ${watch.functionLabel} — ${watch.enterpriseName}`,
          `  Each ${watch.each ? `of the first ${watch.each.first} "${watch.each.list}"` : "file"}:    ${watch.instruction}`,
          `  Set up by:    ${watch.setUpBy}`,
          `  Taken in:     ${takenIn.length} file${takenIn.length === 1 ? "" : "s"}${last ? `, most recently ${last.fileName} (${last.artefactReference}, ${(last.taskIds ?? [last.taskId]).join(", ")})` : ""}`,
          ...files
            .filter((file) => file.skipped && !file.skipped.startsWith("It was already"))
            .slice(-3)
            .map((file) => `  Not handled:  ${file.fileName} — ${file.skipped}`),
        ].join("\n")
      );
    }
    return;
  }

  if (operation === "remove") {
    if (!reference) {
      console.log(USAGE);
      return;
    }
    console.log(
      removeWatchedFolder(reference)
        ? `Stopped watching (${reference}). Documents and Tasks it already created are unchanged.`
        : `There is no watch called ${reference}. See them with /artefact watch list`
    );
    return;
  }

  if (operation !== "add") {
    console.log(USAGE);
    return;
  }

  const functionReference = getArtefactFlagValue(args, "--function");
  const enterpriseReference = getArtefactFlagValue(args, "--enterprise");
  const instruction = getArtefactFlagValue(args, "--task");
  const personReference = getArtefactFlagValue(args, "--created-by");
  const eachList = getArtefactFlagValue(args, "--each")?.trim();
  const firstRaw = getArtefactFlagValue(args, "--first");
  const first = firstRaw === undefined ? 3 : Number(firstRaw);

  if (
    (firstRaw !== undefined && !eachList) ||
    (eachList !== undefined &&
      (!eachList || !Number.isInteger(first) || first < 1 || first > MAX_ENTRIES_PER_FILE))
  ) {
    console.log(
      `Folder not watched: --each names a list in the JSON file and --first says how many of its entries to take, from 1 to ${MAX_ENTRIES_PER_FILE}. For example: --each "trends" --first 3`
    );
    return;
  }

  if (
    !reference ||
    reference.startsWith("--") ||
    !functionReference ||
    !enterpriseReference ||
    !instruction ||
    !personReference
  ) {
    console.log(USAGE);
    return;
  }

  const folder = realPath(expandHomeDirectory(reference));
  if (!folder || !fs.statSync(folder).isDirectory()) {
    console.log(
      `Folder not watched: no folder was found at ${expandHomeDirectory(reference)}. Create it first, then run this again.`
    );
    return;
  }
  const refusal = refuseWatchedFolder(
    folder,
    realPath(os.homedir()) ?? os.homedir(),
    realPath(resolveRuntimeDataDirectory()) ?? resolveRuntimeDataDirectory()
  );
  if (refusal) {
    console.log(`Folder not watched: ${refusal}`);
    return;
  }
  if (listWatchedFolders().some((watch) => watch.folder === folder)) {
    console.log(
      "Folder not watched: that folder is already being watched. See it with /artefact watch list"
    );
    return;
  }

  const enterprise = getEnterpriseByIdOrName(enterpriseReference);
  if (!enterprise) {
    console.log(`Folder not watched: Enterprise not found: ${enterpriseReference}`);
    return;
  }
  const definition = listBusinessFunctionDefinitionsByEnterprise(enterprise.id).find(
    (candidate) =>
      candidate.label.toLowerCase() === functionReference.toLowerCase() ||
      candidate.id === functionReference
  );
  if (!definition) {
    console.log(
      `Folder not watched: ${enterprise.name} has no Function called ${functionReference}. See them with /functions`
    );
    return;
  }
  // A person, because someone has to have chosen to trust what lands here.
  const person = getWorker(personReference);
  if (!person || person.kind !== "human") {
    console.log(
      `Folder not watched: ${personReference} is not a registered person. The person who sets a watch up is recorded as having supplied every file it takes in. Add one with /add-human-worker`
    );
    return;
  }

  const watched = addWatchedFolder({
    folder,
    enterpriseId: enterprise.id,
    enterpriseName: enterprise.name,
    functionLabel: definition.label,
    instruction,
    setUpBy: person.displayName ?? person.name,
    ...(eachList ? { each: { list: eachList, first } } : {}),
  });

  console.log(
    [
      `Watching ${watched.folder} (${watched.id}).`,
      eachList
        ? `Each new .json file that arrives is registered as a document. Arturo then takes the first ${first} entr${first === 1 ? "y" : "ies"} of its "${eachList}" list, in the order the file gives them and with no AI model involved, and gives ${definition.label} one Task for each, with only that entry and this instruction:`
        : `Each new .txt, .md, .csv, .json or .docx file that arrives is registered as a document and given to ${definition.label} with this instruction:`,
      `  ${instruction}`,
      "",
      "Files already in the folder are left alone. A file is picked up once it has stopped changing, usually within half a minute, and only while Arturo is running.",
      "Arturo reads the files. It never runs them, and it does not follow links out of the folder.",
      "",
      "See what has arrived:  /artefact watch list",
      `Stop watching:         /artefact watch remove ${watched.id}`,
    ].join("\n")
  );
}
