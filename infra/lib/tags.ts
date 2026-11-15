import { Tags } from 'aws-cdk-lib';
import { IConstruct } from 'constructs';

export const PROJECT = 'coffee-store';

/** Tags every resource in the stack, so the project can be found, filtered and billed as one. */
export const tagStack = (scope: IConstruct): void => {
  const tags = Tags.of(scope);
  tags.add('Project', PROJECT);
  tags.add('Environment', 'prod');
  tags.add('Purpose', 'technical-test');
  tags.add('ManagedBy', 'cdk');
};
