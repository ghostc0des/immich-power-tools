import {
  LIST_WORKFLOWS_PATH,
  CREATE_WORKFLOW_PATH,
  GET_WORKFLOW_PATH,
  UPDATE_WORKFLOW_PATH,
  DELETE_WORKFLOW_PATH,
  SAVE_WORKFLOW_GRAPH_PATH,
  RUN_WORKFLOW_PATH,
  WORKFLOW_RUNS_PATH,
  EXPORT_WORKFLOW_PATH,
  IMPORT_WORKFLOW_PATH,
} from "@/config/routes";
import API from "@/lib/api";
import { IWorkflow, IWorkflowWithDetails, IWorkflowRun, IWorkflowExport } from "@/types/workflow";

export const listWorkflows = async (): Promise<IWorkflow[]> => {
  return API.get(LIST_WORKFLOWS_PATH);
};

export const createWorkflow = async (data: { name: string; description?: string }): Promise<IWorkflow> => {
  return API.post(CREATE_WORKFLOW_PATH, data);
};

export const getWorkflow = async (id: string): Promise<IWorkflowWithDetails> => {
  return API.get(GET_WORKFLOW_PATH(id));
};

export const updateWorkflow = async (id: string, data: Partial<IWorkflow>): Promise<IWorkflow> => {
  return API.put(UPDATE_WORKFLOW_PATH(id), data);
};

export const deleteWorkflow = async (id: string): Promise<void> => {
  return API.delete(DELETE_WORKFLOW_PATH(id));
};

export const saveWorkflowGraph = async (
  id: string,
  data: { nodes: any[]; edges: any[]; viewport?: any }
): Promise<void> => {
  return API.put(SAVE_WORKFLOW_GRAPH_PATH(id), data);
};

export const runWorkflow = async (id: string, mode?: "manual" | "debug"): Promise<IWorkflowRun> => {
  return API.post(RUN_WORKFLOW_PATH(id), { mode });
};

export const getWorkflowRuns = async (id: string): Promise<IWorkflowRun[]> => {
  return API.get(WORKFLOW_RUNS_PATH(id));
};

export const exportWorkflow = async (id: string): Promise<IWorkflowExport> => {
  return API.get(EXPORT_WORKFLOW_PATH(id));
};

export const importWorkflow = async (data: IWorkflowExport): Promise<IWorkflow> => {
  return API.post(IMPORT_WORKFLOW_PATH, data);
};
