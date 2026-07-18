/**
 * Pure, testable rules for the platform Reliability/Ops module (SuperAdmin):
 * background-job and deployment status transitions.
 */
export type JobStatus = 'QUEUED' | 'RUNNING' | 'SUCCESS' | 'FAILED';
export type DeploymentStatus = 'PENDING' | 'DEPLOYED' | 'FAILED' | 'ROLLED_BACK';

export interface InvariantResult {
  ok: boolean;
  code?: string;
  message?: string;
}

const JOB_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  QUEUED: ['RUNNING'],
  RUNNING: ['SUCCESS', 'FAILED'],
  FAILED: ['QUEUED'], // retry
  SUCCESS: [],
};

export function jobCanTransition(from: JobStatus, to: JobStatus): InvariantResult {
  if (!JOB_TRANSITIONS[from].includes(to)) {
    return { ok: false, code: 'JOB_INVALID_TRANSITION', message: `A job cannot move from ${from} to ${to}.` };
  }
  return { ok: true };
}

const DEPLOY_TRANSITIONS: Record<DeploymentStatus, DeploymentStatus[]> = {
  PENDING: ['DEPLOYED', 'FAILED'],
  DEPLOYED: ['ROLLED_BACK'],
  FAILED: [],
  ROLLED_BACK: [],
};

export function deploymentCanTransition(from: DeploymentStatus, to: DeploymentStatus): InvariantResult {
  if (!DEPLOY_TRANSITIONS[from].includes(to)) {
    return { ok: false, code: 'DEPLOYMENT_INVALID_TRANSITION', message: `A deployment cannot move from ${from} to ${to}.` };
  }
  return { ok: true };
}
