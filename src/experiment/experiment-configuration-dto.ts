import { IRule } from '../rule-dto';

import { IAllocation } from './allocation-dto';

export interface IExperimentConfiguration {
  name: string;
  enabled: boolean;
  subjectShards: number;
  overrides: Record<string, string>;
  allocations: Record<string, IAllocation>;
  rules?: IRule[];
}
