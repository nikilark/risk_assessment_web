import Dexie, { type Table } from "dexie";
import type { ProjectFile } from "../domain/types";

interface AutosaveRecord {
  id: "current";
  updatedAt: string;
  project: ProjectFile;
}

class RiskAssessmentDb extends Dexie {
  autosaves!: Table<AutosaveRecord, "current">;

  constructor() {
    super("risk-assessment-tool");
    this.version(1).stores({
      autosaves: "id, updatedAt"
    });
  }
}

const db = new RiskAssessmentDb();

export async function loadAutosave(): Promise<ProjectFile | undefined> {
  return (await db.autosaves.get("current"))?.project;
}

export async function saveAutosave(project: ProjectFile): Promise<void> {
  await db.autosaves.put({ id: "current", updatedAt: new Date().toISOString(), project });
}

export async function clearAutosave(): Promise<void> {
  await db.autosaves.delete("current");
}

