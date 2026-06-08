export interface TaskService {
  launchTask(evaluationId: string): Promise<void>;
}
