export interface CommitSummary {
  hash: string;
  message: string;
  author: string;
  date: Date;
}

export interface BranchInfo {
  name: string;
  isRemote: boolean;
  lastCommitDate: Date;
}

export interface TodoItem {
  file: string;
  line: number;
  text: string;
  type: "TODO" | "FIXME" | "HACK" | "XXX";
}

export interface Dependency {
  name: string;
  currentVersion: string;
  latestVersion?: string;
  isOutdated: boolean;
}

export interface ProjectContext {
  project: {
    name: string;
    purpose: string;
    techStack: string[];
  };
  activity: {
    recentCommits: CommitSummary[];
    activeBranches: BranchInfo[];
    uncommittedChanges: string[];
  };
  health: {
    todos: TodoItem[];
    outdatedDeps: Dependency[];
    testCoverage?: number;
    vulnerabilities?: {
      total: number;
      critical: number;
      high: number;
      moderate: number;
      low: number;
    };
  };
  docs: {
    hasReadme: boolean;
    hasChangelog: boolean;
    lastDocUpdate?: Date;
  };
}
